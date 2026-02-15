/**
 * SIWE (Sign-In with Ethereum) utility for API authentication.
 *
 * Builds Lit-compatible delegation SIWE messages where:
 *  - uri = "lit:session:<sessionPublicKey>"  (binds to session key)
 *  - nonce = latestBlockhash from the Lit network
 *  - ReCap grants access-control-condition-decryption for the resource
 *
 * AI agents only need to `signMessage(message)` and echo the opaque token back.
 *
 * IMPORTANT: Uses createSiweMessageWithResources from @lit-protocol/auth-helpers
 * (which internally uses siwe@2.x) to produce SIWE messages in the exact format
 * that Lit network nodes expect. The top-level siwe@3.x is only used for parsing.
 */
import { LitAccessControlConditionResource, createSiweMessageWithResources } from "@lit-protocol/auth-helpers";
import { LIT_ABILITY, SIWE_URI_PREFIX } from "@lit-protocol/constants";
import type { AuthSig } from "@lit-protocol/types";
import { SiweMessage } from "siwe";
import { BadRequestError, UnauthorizedError } from "~~/utils/scaffold-eth/errors";

export type SiweAuthData = {
  message: string;
  signature: string;
  opaqueToken?: string;
};

/**
 * Parameters to build a SIWE delegation message for Lit Protocol.
 */
export type BuildSiweMessageParams = {
  /** Authority requesting the signing (e.g. hostname) */
  domain: string;
  /** Signer's Ethereum address (checksum format preferred) */
  address: string;
  /** Session key URI ("lit:session:<publicKey>") */
  sessionKeyUri: string;
  /** Nonce — must be the Lit network latestBlockhash */
  nonce: string;
  /** Human-readable statement (optional) */
  statement?: string;
  /** EIP-155 chain id (default 1) */
  chainId?: number;
  /** ISO 8601 expiration (optional, default 5 min) */
  expirationTime?: string;
  /**
   * Lit decrypt resource id (hashOfConditionsStr + "/" + dataToEncryptHash).
   * When set, the SIWE message includes a ReCap granting access-control-condition-decryption.
   */
  resourceId?: string;
};

/** Default expiry for SIWE message when not provided (5 minutes). Lit session-sig validation requires "Expiration Time" in the signed message. */
const DEFAULT_SIWE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Build a Lit-compatible SIWE delegation message.
 *
 * Uses the SDK's own createSiweMessageWithResources (which internally uses
 * siwe@2.x) to guarantee the message format matches what Lit nodes expect.
 */
export async function buildSiweMessage(params: BuildSiweMessageParams): Promise<string> {
  const expiration = params.expirationTime ?? new Date(Date.now() + DEFAULT_SIWE_EXPIRY_MS).toISOString();

  const { domain, sessionKeyUri, address, nonce, statement, chainId = 1, resourceId } = params;

  const resources = resourceId
    ? [
        {
          resource: new LitAccessControlConditionResource(resourceId),
          ability: LIT_ABILITY.AccessControlConditionDecryption,
        },
      ]
    : [];

  return createSiweMessageWithResources({
    uri: sessionKeyUri,
    domain,
    walletAddress: address,
    statement: statement ?? "Lit Protocol session delegation",
    version: "1",
    chainId,
    nonce,
    expiration,
    resources,
  });
}

/**
 * Validate SIWE message fields.
 *
 * The URI must start with "lit:session:" (session-key delegation).
 * Domain, expiration, issuedAt and address are also verified.
 */
export function validateSiweMessage(
  siweMessage: SiweMessage,
  expectedDomain: string,
  expectedAddress: string,
  maxAge: number = 5 * 60, // 5 minutes default
): boolean {
  // Validate domain
  if (siweMessage.domain !== expectedDomain) {
    throw new UnauthorizedError(`Invalid domain: expected ${expectedDomain}, got ${siweMessage.domain}`);
  }

  // Validate URI is a Lit session key URI
  if (!siweMessage.uri.startsWith(SIWE_URI_PREFIX.SESSION_KEY)) {
    throw new UnauthorizedError(`Invalid URI: expected lit:session: prefix, got ${siweMessage.uri}`);
  }

  // Validate address matches expected
  if (siweMessage.address.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new UnauthorizedError("Address mismatch: message address does not match provided address");
  }

  // Validate expiration time if present
  if (siweMessage.expirationTime) {
    const expirationDate = new Date(siweMessage.expirationTime);
    if (expirationDate < new Date()) {
      throw new UnauthorizedError("SIWE message has expired");
    }
  }

  // Validate issued at time (not too old)
  const issuedAt = siweMessage.issuedAt;
  if (!issuedAt) {
    throw new BadRequestError("SIWE message missing required 'issuedAt' field");
  }
  const issuedAtDate = new Date(issuedAt);
  const now = new Date();
  const ageSeconds = (now.getTime() - issuedAtDate.getTime()) / 1000;

  if (ageSeconds > maxAge) {
    throw new UnauthorizedError(`SIWE message is too old: ${ageSeconds}s > ${maxAge}s`);
  }

  // Validate not before if present
  if (siweMessage.notBefore) {
    const notBeforeDate = new Date(siweMessage.notBefore);
    if (notBeforeDate > new Date()) {
      throw new UnauthorizedError("SIWE message is not yet valid");
    }
  }

  return true;
}

/**
 * Verify SIWE message signature using siwe package
 *
 * @param siweMessage - Parsed SiweMessage instance
 * @param signature - The signature (0x...)
 * @param expectedAddress - The expected signer address
 * @returns True if signature is valid
 */
export async function verifySiweSignature(
  siweMessage: SiweMessage,
  signature: string,
  expectedAddress: string,
): Promise<boolean> {
  try {
    // Normalize addresses to lowercase for comparison
    const normalizedExpected = expectedAddress.toLowerCase();
    const messageAddress = siweMessage.address.toLowerCase();

    // Verify signature using siwe package's verify method
    // This validates that the signature matches the message and address
    const result = await siweMessage.verify({
      signature: signature as `0x${string}`,
    });

    if (!result.success) {
      return false;
    }

    // Verify the address in the message matches the expected address
    return messageAddress === normalizedExpected;
  } catch (error) {
    console.error("Error verifying SIWE signature:", error);
    return false;
  }
}

/**
 * Convert SIWE signature to Lit Protocol authSig format
 *
 * @param message - The SIWE message that was signed
 * @param signature - The signature (0x...)
 * @param address - The signer's address
 * @returns AuthSig object compatible with Lit Protocol
 */
export function siweToAuthSig(message: string, signature: string, address: string): AuthSig {
  return {
    sig: signature,
    derivedVia: "web3.eth.personal.sign",
    signedMessage: message,
    address: address.toLowerCase(), // Lit Protocol expects lowercase
  };
}

type ParsedSiweAuth = {
  authSig: AuthSig;
  opaqueToken: string;
};

/**
 * Parse and verify SIWE authentication from Authorization header.
 *
 * The payload is a base64-encoded JSON with { message, signature, opaqueToken }.
 * Returns both the Lit-compatible authSig and the opaqueToken (encrypted session key pair).
 */
export async function parseAndVerifySiweAuth(
  authHeader: string,
  expectedDomain: string,
  expectedAddress: string,
): Promise<ParsedSiweAuth> {
  // Remove "Bearer " prefix
  if (!authHeader.startsWith("Bearer ")) {
    throw new BadRequestError("Invalid authorization header format: must start with 'Bearer '");
  }

  const token = authHeader.substring(7);

  // Decode base64 and parse JSON
  let authData: SiweAuthData;
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    authData = JSON.parse(decoded);
  } catch {
    throw new BadRequestError("Invalid authorization token: failed to decode or parse");
  }

  // Validate required fields
  if (!authData.message || !authData.signature) {
    throw new BadRequestError("Invalid authorization data: missing message or signature");
  }

  if (!authData.opaqueToken) {
    throw new BadRequestError("Invalid authorization data: missing opaqueToken");
  }

  // Parse SIWE message using official siwe package
  let siweMessage: SiweMessage;
  try {
    siweMessage = new SiweMessage(authData.message);
  } catch (error) {
    throw new BadRequestError(
      `Invalid SIWE message format: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  // Validate message fields (domain, lit:session: URI, address, expiry)
  validateSiweMessage(siweMessage, expectedDomain, expectedAddress);

  // Verify signature matches address using siwe package
  const isValid = await verifySiweSignature(siweMessage, authData.signature, expectedAddress);

  if (!isValid) {
    throw new UnauthorizedError("Invalid signature: signature does not match address");
  }

  return {
    authSig: siweToAuthSig(authData.message, authData.signature, expectedAddress),
    opaqueToken: authData.opaqueToken,
  };
}
