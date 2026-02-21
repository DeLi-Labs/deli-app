/**
 * Google Authentication utility for Lit Protocol
 *
 * Note: GoogleAuthenticator.authenticate() does NOT store tokens automatically.
 * This utility provides manual storage/retrieval of AuthData since Lit Protocol's
 * storage system (via AuthManager) is designed for PKP data and auth contexts,
 * not raw authentication tokens from authenticators.
 *
 * We manually store AuthData in localStorage with expiry handling.
 */
import { getHashedAccessControlConditions } from "@lit-protocol/access-control-conditions";
import { GoogleAuthenticator } from "@lit-protocol/auth";
import { LitAccessControlConditionResource } from "@lit-protocol/auth-helpers";
import { AUTH_METHOD_TYPE, LIT_ABILITY } from "@lit-protocol/constants";
import type { AuthData } from "@lit-protocol/schemas";
import { EoaAuthContextSchema } from "@lit-protocol/schemas";
import type { AccessControlConditions, AuthSig } from "@lit-protocol/types";
import { uint8arrayToString } from "@lit-protocol/uint8arrays";
import { getAddress, keccak256, stringToBytes } from "viem";
import { encodeAbiParameters } from "viem";
import type { Account } from "viem";
import type { z } from "zod";
import type { SessionKeyPair } from "~~/utils/lit/client";
import { type LitClient, getLitClient } from "~~/utils/lit/client";

const AUTH_STORAGE_KEY = "lit_google_auth_data";
const AUTH_EXPIRY_KEY = "lit_google_auth_expiry";

// Auth data expires after 1 hour (Google OAuth tokens typically last 1 hour)
const AUTH_EXPIRY_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

const PAYMENT_INFO_TYPEHASH = keccak256(
  new TextEncoder().encode(
    "PaymentInfo(address operator,address payer,address receiver,address token,uint120 maxAmount,uint48 preApprovalExpiry,uint48 authorizationExpiry,uint48 refundExpiry,uint16 minFeeBps,uint16 maxFeeBps,address feeReceiver,uint256 salt)",
  ),
);

export type PKPInfo = {
  pubkey: string;
  ethAddress: `0x${string}`;
  txHash?: string;
  queryableAt?: Date;
};

/**
 * Get stored authentication data if still valid
 * Returns full AuthData object
 */
export const getStoredAuthData = (): AuthData | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedAuthData = localStorage.getItem(AUTH_STORAGE_KEY);
    const storedExpiry = localStorage.getItem(AUTH_EXPIRY_KEY);

    if (!storedAuthData || !storedExpiry) {
      return null;
    }

    const expiryTime = parseInt(storedExpiry, 10);
    if (Date.now() > expiryTime) {
      // Auth expired, clear storage
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_EXPIRY_KEY);
      return null;
    }

    const authData: AuthData = JSON.parse(storedAuthData);
    return authData;
  } catch (error) {
    console.error("Error reading stored auth:", error);
    return null;
  }
};

/**
 * Store authentication data
 */
export const storeAuthData = (authData: AuthData): void => {
  if (typeof window === "undefined") return;

  try {
    const expiryTime = Date.now() + AUTH_EXPIRY_DURATION;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
    localStorage.setItem(AUTH_EXPIRY_KEY, expiryTime.toString());
  } catch (error) {
    console.error("Error storing auth:", error);
  }
};

/**
 * Clear stored authentication data
 */
export const clearStoredAuth = (): void => {
  if (typeof window === "undefined") return;

  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(AUTH_EXPIRY_KEY);
};

/**
 * Authenticate with Google OAuth via Lit Protocol
 * Returns full AuthData object
 */
export const authenticateWithGoogle = async (): Promise<AuthData> => {
  const loginUrl = process.env.NEXT_PUBLIC_LIT_LOGIN_URL || "https://login.litgateway.com";

  // Authenticate with Google using popup (v8 SDK)
  const authData: AuthData = await GoogleAuthenticator.authenticate(loginUrl);

  // Store auth data
  storeAuthData(authData);

  return authData;
};

/**
 * Get authentication data, authenticating if necessary
 * Returns null if authentication fails
 */
export const getAuthData = async (): Promise<AuthData | null> => {
  // Check if we have valid stored auth
  const storedAuth = getStoredAuthData();
  if (storedAuth) {
    return storedAuth;
  }

  // No valid auth, authenticate
  try {
    const authData = await authenticateWithGoogle();
    return authData;
  } catch (error) {
    console.error("Failed to authenticate with Google:", error);
    return null;
  }
};

/**
 * Get authentication token (serialized AuthData) for API requests
 * Returns null if authentication fails
 */
export const getAuthToken = async (): Promise<string | null> => {
  const authData = await getAuthData();
  if (!authData) {
    return null;
  }
  return JSON.stringify(authData);
};

export async function addAdminPermission(account: Account, pkpInfo: PKPInfo): Promise<void> {
  const adminAddress = process.env.NEXT_PUBLIC_ADMIN_APP_ADDRESS;
  if (!adminAddress) {
    throw new Error("NEXT_PUBLIC_ADMIN_APP_ADDRESS is not set");
  }

  const litClient = await getLitClient();

  await litClient
    .getPKPPermissionsManager({
      pkpIdentifier: { pubkey: pkpInfo.pubkey },
      account,
    })
    .then(pkpPermissionsManager => {
      return pkpPermissionsManager
        .addPermittedAddress({
          address: adminAddress,
          scopes: ["sign-anything"],
        })
        .catch((error: any) => {
          console.error("Error adding admin permission:", error);
          throw error;
        });
    })
    .catch((error: any) => {
      console.error("Error getting PKP permissions manager:", error);
      throw error;
    });
}

/**
 * Get PKP for given auth data
 * Queries existing PKPs first, if none found, mints a new one
 * No retries - returns immediately with mint result data if needed
 */
export const getPKP = async (authData: AuthData, litClient: LitClient): Promise<PKPInfo> => {
  // Query existing PKPs
  const existingPkps = await litClient.viewPKPsByAuthData({
    authData: {
      authMethodType: authData.authMethodType,
      authMethodId: authData.authMethodId,
    },
    pagination: {
      limit: 5,
      offset: 0,
    },
  });

  // Check if we have existing PKPs
  // Handle both array response and object with pkps property
  const pkps = existingPkps.pkps;

  if (pkps && pkps.length > 0) {
    // Use existing PKP
    return {
      pubkey: pkps[0].pubkey,
      ethAddress: pkps[0].ethAddress,
      queryableAt: new Date(), // Already queryable since it exists
    };
  }

  // No existing PKP, mint new one
  const mintResult = await litClient.authService.mintWithAuth({
    authData: authData,
    authServiceBaseUrl: process.env.NEXT_PUBLIC_LIT_AUTH_SERVICE_URL || "https://naga-dev-auth-service.getlit.dev",
    scopes: ["sign-anything", "personal-sign"],
  });

  // Return PKP info from mint result (no retries, as requested)
  return {
    pubkey: mintResult?.data?.pubkey || "",
    ethAddress: mintResult?.data?.ethAddress,
    txHash: mintResult?.txHash,
    queryableAt: undefined, // Not yet verified on-chain
  };
};

export type EoaAuthContextForDecrypt = z.infer<typeof EoaAuthContextSchema>;

/**
 * Compute the Lit decrypt resource id (hashOfConditions + "/" + dataToEncryptHash).
 * Use this when returning a 401 SIWE challenge for encrypted attachments so the client can include the ReCap in the message.
 */
export async function computeDecryptResourceId(
  accessControlConditions: AccessControlConditions,
  dataToEncryptHash: string,
): Promise<string> {
  const hashOfConditions = await getHashedAccessControlConditions({
    accessControlConditions,
  });
  if (!hashOfConditions) {
    throw new Error("Failed to hash access control conditions");
  }
  const hashOfConditionsStr = uint8arrayToString(new Uint8Array(hashOfConditions), "base16");
  return `${hashOfConditionsStr}/${dataToEncryptHash}`;
}

/**
 * Build the EoaAuthContext needed for litClient.decrypt().
 *
 * The sessionKeyPair was generated at challenge-time, encrypted into the
 * opaque token, and now recovered by the server. The authSig is the signed
 * SIWE delegation whose uri = "lit:session:<sessionPubKey>".
 */
export async function buildAuthContextForDecrypt(
  accessControlConditions: AccessControlConditions,
  dataToEncryptHash: string,
  authSig: AuthSig,
  sessionKeyPair: SessionKeyPair,
  domain: string = "localhost",
): Promise<EoaAuthContextForDecrypt> {
  const resourceId = await computeDecryptResourceId(accessControlConditions, dataToEncryptHash);

  const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const authConfig = {
    capabilityAuthSigs: [] as AuthSig[],
    expiration,
    statement: "",
    domain,
    resources: [
      {
        resource: new LitAccessControlConditionResource(resourceId),
        ability: LIT_ABILITY.AccessControlConditionDecryption,
      },
    ],
  };

  const checksumAddress = getAddress(authSig.address);
  const authMethodId = keccak256(stringToBytes(`${checksumAddress}:lit`));

  const authData = {
    authMethodType: AUTH_METHOD_TYPE.EthWallet,
    accessToken: JSON.stringify(authSig),
    authMethodId,
  };

  return EoaAuthContextSchema.parse({
    account: { address: authSig.address },
    authenticator: {},
    authData,
    authNeededCallback: () => Promise.resolve(authSig),
    sessionKeyPair,
    authConfig,
  });
}

export async function computePaymentInfoHash(paymentInfo: Record<string, unknown>): Promise<string> {
  const paymentInfoEncoded = encodeAbiParameters(
    [
      { type: "bytes32" }, // PAYMENT_INFO_TYPEHASH
      { type: "address" }, // operator
      { type: "address" }, // payer
      { type: "address" }, // receiver
      { type: "address" }, // token
      { type: "uint120" }, // maxAmount
      { type: "uint48" }, // preApprovalExpiry
      { type: "uint48" }, // authorizationExpiry
      { type: "uint48" }, // refundExpiry
      { type: "uint16" }, // minFeeBps
      { type: "uint16" }, // maxFeeBps
      { type: "address" }, // feeReceiver
      { type: "uint256" }, // salt
    ],
    [
      PAYMENT_INFO_TYPEHASH,
      paymentInfo.operator as string,
      paymentInfo.payer as string,
      paymentInfo.receiver as string,
      paymentInfo.token as string,
      BigInt(paymentInfo.maxAmount as string),
      Number(paymentInfo.preApprovalExpiry as string),
      Number(paymentInfo.authorizationExpiry as string),
      Number(paymentInfo.refundExpiry as string),
      paymentInfo.minFeeBps as number,
      paymentInfo.maxFeeBps as number,
      paymentInfo.feeReceiver as string,
      BigInt(paymentInfo.salt as string),
    ],
  );
  return keccak256(paymentInfoEncoded);
}
