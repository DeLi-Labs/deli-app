import { StorageGatewayType } from "../StorageGatewayFactory";
import type { IStorageGateway, RetrieveResult, StorageResult, StoreOptions } from "../storage";

/**
 * Arweave storage gateway implementation
 *
 * Note: This is a basic implementation. For production use, you may want to:
 * - Install arweave-js: yarn add arweave
 * - Implement proper transaction signing and posting
 * - Handle Arweave-specific features like permanent storage
 */
export class ArweaveStorageGateway implements IStorageGateway {
  private readonly gatewayUrl: string;

  constructor(gatewayUrl?: string) {
    // Default to public Arweave gateway
    this.gatewayUrl = gatewayUrl || process.env.NEXT_PUBLIC_ARWEAVE_GATEWAY_URL || "https://arweave.net";
  }

  async store(_data: Buffer | Uint8Array, _options?: StoreOptions): Promise<StorageResult> {
    // This is a placeholder implementation
    // In production, you would:
    // 1. Create an Arweave transaction
    // 2. Sign it with a wallet
    // 3. Post it to the Arweave network
    // 4. Wait for confirmation

    throw new Error(
      "Arweave storage not fully implemented. " +
        "Please install arweave-js and implement transaction creation and posting.",
    );
  }

  async storeJson<T extends Record<string, unknown>>(json: T, options?: StoreOptions): Promise<StorageResult> {
    const jsonString = JSON.stringify(json);
    const jsonBuffer = Buffer.from(jsonString, "utf-8");
    return this.store(jsonBuffer, {
      ...options,
      contentType: options?.contentType || "application/json",
    });
  }

  async retrieve(uri: string): Promise<RetrieveResult> {
    if (!uri.startsWith("ar://") && !uri.startsWith("https://arweave.net/")) {
      throw new Error(`Invalid Arweave URI: ${uri}`);
    }

    // Extract transaction ID from URI
    let txId: string;
    if (uri.startsWith("ar://")) {
      txId = uri.replace("ar://", "");
    } else if (uri.startsWith("https://arweave.net/")) {
      txId = uri.replace("https://arweave.net/", "");
    } else {
      txId = uri;
    }

    try {
      const response = await fetch(`${this.gatewayUrl}/${txId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch from Arweave: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = Buffer.from(arrayBuffer);
      const contentType = response.headers.get("content-type") || undefined;
      const size = data.length;

      return {
        data,
        contentType,
        size,
      };
    } catch (error) {
      throw new Error(
        `Failed to retrieve data from Arweave: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async retrieveJson<T extends Record<string, unknown>>(uri: string): Promise<T> {
    const result = await this.retrieve(uri);
    try {
      const text =
        result.data instanceof Buffer ? result.data.toString("utf-8") : new TextDecoder().decode(result.data);
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON from Arweave: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async exists(uri: string): Promise<boolean> {
    if (!uri.startsWith("ar://") && !uri.startsWith("https://arweave.net/")) {
      return false;
    }

    try {
      const result = await this.retrieve(uri);
      return result.size > 0;
    } catch {
      return false;
    }
  }

  async delete(_uri: string): Promise<boolean> {
    // Arweave is permanent storage - deletion is not supported
    return false;
  }

  getStorageType(): string {
    return StorageGatewayType.ARWEAVE;
  }
}
