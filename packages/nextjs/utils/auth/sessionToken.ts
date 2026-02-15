/**
 * Opaque session-token utility for the Lit delegation flow.
 *
 * The server encrypts the session key pair (generated for the SIWE challenge)
 * into an opaque token using AES-256-GCM so the flow stays stateless.
 * The AI agent echoes the token back and the server decrypts it to recover
 * the session key pair for Lit decryption.
 *
 * Requires SESSION_TOKEN_SECRET env var (64-char hex = 32 bytes).
 */
import crypto from "crypto";
import type { SessionKeyPair } from "~~/utils/lit/client";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

type TokenPayload = {
  sessionKeyPair: SessionKeyPair;
  expiresAt: number;
};

let cachedSecret: Buffer | null = null;

function getSecret(): Buffer {
  if (cachedSecret) return cachedSecret;

  const hex = process.env.SESSION_TOKEN_SECRET;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "SESSION_TOKEN_SECRET must be a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  cachedSecret = Buffer.from(hex, "hex");
  return cachedSecret;
}

/**
 * Encrypt a session key pair into an opaque base64 token.
 */
export function encryptSessionToken(sessionKeyPair: SessionKeyPair): string {
  const key = getSecret();
  const iv = crypto.randomBytes(IV_LENGTH);

  const payload: TokenPayload = {
    sessionKeyPair,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const plaintext = Buffer.from(JSON.stringify(payload), "utf-8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv (12) + authTag (16) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt an opaque token back into a session key pair.
 * Throws if the token is expired, tampered, or malformed.
 */
export function decryptSessionToken(token: string): SessionKeyPair {
  const key = getSecret();
  const raw = Buffer.from(token, "base64");

  if (raw.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid session token: too short");
  }

  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted: Buffer;
  try {
    decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Invalid session token: decryption failed (tampered or wrong key)");
  }

  const parsed = JSON.parse(decrypted.toString("utf-8"));

  if (
    !parsed?.sessionKeyPair?.publicKey ||
    !parsed?.sessionKeyPair?.secretKey ||
    typeof parsed.expiresAt !== "number"
  ) {
    throw new Error("Invalid session token: malformed payload");
  }

  const payload = parsed as TokenPayload;

  if (Date.now() > payload.expiresAt) {
    throw new Error("Session token expired");
  }

  return payload.sessionKeyPair;
}
