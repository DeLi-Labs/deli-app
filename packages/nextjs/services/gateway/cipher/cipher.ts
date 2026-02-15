import type { AuthSig } from "@lit-protocol/types";
import type { SessionKeyPair } from "~~/utils/lit/client";

/**
 * Supported data types for encryption/decryption
 */
export type EncryptableData = string | Uint8Array | File | Blob;

/**
 * Authentication for decryption.
 *
 * authSig: the signed SIWE delegation (uri = lit:session:<pubKey>).
 * sessionKeyPair: the key pair generated at challenge-time, recovered from the opaque token.
 */
export type DecryptionAuth = {
  authSig: AuthSig;
  sessionKeyPair: SessionKeyPair;
};

/**
 * Options for encryption operations
 */
export type EncryptOptions = {
  /**
   * Chain identifier (e.g., 'ethereum', 'sepolia', 'polygon')
   * Implementation-specific requirement
   */
  chain?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Options for decryption operations
 */
export type DecryptOptions = {
  /**
   * Authentication required for decryption
   * Must provide authContext
   */
  auth: DecryptionAuth;

  /**
   * Chain identifier (e.g., 'ethereum', 'sepolia', 'polygon')
   * Must match the chain used during encryption
   */
  chain?: string;

  /** Domain used in SIWE message (defaults to "localhost") */
  domain?: string;
};

/**
 * Result of encryption operation
 */
export type EncryptionResult = {
  /**
   * The encrypted data (ciphertext)
   * Format depends on implementation (base64 string, Uint8Array, etc.)
   */
  ciphertext: EncryptedData;
};

/**
 * Class that encapsulates encrypted data, hash, and metadata
 *
 * Storage format: Single array containing:
 * - Hash (64-character hex string)
 * - Metadata length (4-byte uint32, big-endian)
 * - Metadata (JSON string)
 * - Actual encrypted data (base64 encoded)
 */
export class EncryptedData {
  private data: Uint8Array;
  private hash: string;
  private metadata: Record<string, unknown>;

  /**
   * Create EncryptedData from components
   */
  constructor(data: Uint8Array | string, hash: string, metadata: Record<string, unknown> = {}) {
    this.data = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
    this.hash = hash;
    this.metadata = metadata;
  }

  /**
   * Create EncryptedData from serialized format
   * Format: [hash (64 bytes as hex string)] + [metadataLength (4 bytes)] + [metadata (JSON bytes)] + [data (string bytes)] all base64 encoded
   */
  static fromSerialized(serialized: string | Uint8Array): EncryptedData {
    const buffer =
      typeof serialized === "string"
        ? Uint8Array.from(Buffer.from(serialized, "base64"))
        : Uint8Array.from(Buffer.from(Buffer.from(serialized).toString("utf8"), "base64"));

    if (buffer.length < 64 + 4) {
      throw new Error("Invalid serialized format: too short");
    }

    // Extract hash (first 64 bytes as hex string UTF-8)
    const hashBytes = buffer.slice(0, 64);
    const hash = Buffer.from(hashBytes).toString("utf8");

    // Extract metadata length (next 4 bytes as uint32 big-endian)
    const metadataLengthBuffer = buffer.slice(64, 68);
    const metadataLength = new DataView(metadataLengthBuffer.buffer, metadataLengthBuffer.byteOffset, 4).getUint32(
      0,
      false,
    );

    if (buffer.length < 68 + metadataLength) {
      throw new Error("Invalid serialized format: metadata length exceeds buffer");
    }

    // Extract metadata (JSON string as UTF-8 bytes)
    const metadataBytes = buffer.slice(68, 68 + metadataLength);
    const metadataJson = Buffer.from(metadataBytes).toString("utf8");
    const metadata = metadataJson ? JSON.parse(metadataJson) : {};

    // Extract data (remaining bytes, base64 string as UTF-8)
    const dataBytes = buffer.slice(68 + metadataLength);

    return new EncryptedData(dataBytes, hash, metadata);
  }

  /**
   * Serialize to single array format
   * Format: [hash (64 bytes as hex string)] + [metadataLength (4 bytes)] + [metadata (JSON bytes)] + [data (string bytes)] all base64 encoded
   */
  public serialize(): Uint8Array {
    // Validate hash is 64-character hex string
    if (this.hash.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(this.hash)) {
      throw new Error(`Hash must be exactly 64 hexadecimal characters, got length ${this.hash.length}`);
    }

    // Convert hash hex string to bytes (64 bytes)
    const hashBuffer = Buffer.from(this.hash, "utf8");

    // Serialize metadata to JSON string, then to bytes
    const metadataJson = JSON.stringify(this.metadata);
    const metadataBuffer = Buffer.from(metadataJson, "utf8");
    const metadataLength = metadataBuffer.length;

    // Create 4-byte buffer for metadata length (big-endian uint32)
    const metadataLengthBuffer = Buffer.allocUnsafe(4);
    metadataLengthBuffer.writeUInt32BE(metadataLength, 0);

    // Get data as base64 string and convert to bytes
    const dataBuffer = Buffer.from(this.data);

    // Combine all parts
    const result = Buffer.concat([hashBuffer, metadataLengthBuffer, metadataBuffer, dataBuffer]);

    // Encode to base64 string, then convert to UTF-8 bytes
    const base64String = result.toString("base64");
    return Uint8Array.from(Buffer.from(base64String, "utf8"));
  }

  /**
   * Get the encrypted data as base64 string
   */
  public getData(): Uint8Array {
    return this.data;
  }

  /**
   * Get the hash of the original data (64-character hex string)
   */
  public getHash(): string {
    return this.hash;
  }

  /**
   * Get the metadata
   */
  public getMetadata(): Record<string, unknown> {
    return this.metadata;
  }
}

/**
 * Result of decryption operation
 */
export type DecryptionResult = {
  /**
   * The decrypted data
   */
  decryptedData: Uint8Array;

  /**
   * Additional metadata (implementation-specific)
   */
  metadata?: Record<string, unknown>;
};

/**
 * Abstract cipher gateway interface for encryption/decryption operations
 *
 * Implementations should provide concrete encryption backends:
 * - LitCipherGateway (for Lit Protocol encryption with its own condition types)
 * - LocalCipherGateway (for local/symmetric encryption with its own options)
 * - etc.
 *
 * Each implementation defines its own condition types and options structure.
 */
export interface ICipherGateway {
  /**
   * Encrypt data
   *
   * @param data - The data to encrypt (string, Uint8Array, File, or Blob)
   * @param options - Encryption options (implementation-specific)
   * @returns Promise resolving to EncryptionResult with ciphertext and metadata
   * @throws Error if encryption fails or required options are missing
   */
  encrypt(data: EncryptableData, options?: EncryptOptions): Promise<EncryptionResult>;

  /**
   * Decrypt data using authentication
   *
   * @param encryptedData - The encrypted data (ciphertext) to decrypt
   * @param options - Decryption options including authentication (implementation-specific)
   * @returns Promise resolving to DecryptionResult with decrypted data
   * @throws Error if decryption fails, authentication is invalid, or access conditions are not met
   */
  decrypt(encryptedData: EncryptedData, options: DecryptOptions): Promise<DecryptionResult>;
}
