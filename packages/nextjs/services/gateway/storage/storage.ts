/**
 * Abstract storage gateway interface that supports multiple storage backends
 * (IPFS, Arweave, local database, etc.)
 */

/**
 * Result of a storage operation
 */
export interface StorageResult {
  /** URI/identifier that can be used to retrieve the stored content */
  uri: string;
  /** Optional hash/checksum of the stored content */
  hash?: string;
  /** Optional size of the stored content in bytes */
  size?: number;
}

/**
 * Options for storing data
 */
export interface StoreOptions {
  /** Optional content type (MIME type) */
  contentType?: string;
  /** Optional metadata to associate with the stored content */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a retrieval operation
 */
export interface RetrieveResult {
  /** The content as a buffer/array of bytes */
  data: Buffer | Uint8Array;
  /** Content type (MIME type) if available */
  contentType?: string;
  /** Size of the content in bytes */
  size: number;
  /** Optional metadata associated with the content */
  metadata?: Record<string, unknown>;
}

/**
 * Abstract storage gateway interface
 *
 * Implementations should provide concrete storage backends:
 * - IPFSStorageGateway (for IPFS)
 * - ArweaveStorageGateway (for Arweave)
 * - LocalDatabaseStorageGateway (for local database)
 * - etc.
 */
export interface IStorageGateway {
  /**
   * Store raw data (bytes) and return a URI/identifier
   *
   * @param data - The data to store as a Buffer or Uint8Array
   * @param options - Optional storage options
   * @returns Promise resolving to a StorageResult with the URI
   */
  store(data: Buffer | Uint8Array, options?: StoreOptions): Promise<StorageResult>;

  /**
   * Store a JSON object and return a URI/identifier
   *
   * @param json - The JSON object to store
   * @param options - Optional storage options
   * @returns Promise resolving to a StorageResult with the URI
   */
  storeJson<T extends Record<string, unknown>>(json: T, options?: StoreOptions): Promise<StorageResult>;

  /**
   * Retrieve data by URI/identifier
   *
   * @param uri - The URI/identifier of the stored content
   * @returns Promise resolving to the retrieved content
   * @throws Error if the URI is invalid or content is not found
   */
  retrieve(uri: string): Promise<RetrieveResult>;

  /**
   * Retrieve and parse JSON data by URI/identifier
   *
   * @param uri - The URI/identifier of the stored JSON content
   * @returns Promise resolving to the parsed JSON object
   * @throws Error if the URI is invalid, content is not found, or JSON is invalid
   */
  retrieveJson<T extends Record<string, unknown>>(uri: string): Promise<T>;

  /**
   * Check if content exists at the given URI
   *
   * @param uri - The URI/identifier to check
   * @returns Promise resolving to true if content exists, false otherwise
   */
  exists(uri: string): Promise<boolean>;

  /**
   * Delete content at the given URI (if supported by the storage backend)
   *
   * @param uri - The URI/identifier of the content to delete
   * @returns Promise resolving to true if deletion was successful, false otherwise
   */
  delete?(uri: string): Promise<boolean>;

  /**
   * Get the storage type/backend name
   *
   * @returns The name of the storage backend (e.g., "ipfs", "arweave", "local")
   */
  getStorageType(): string;
}
