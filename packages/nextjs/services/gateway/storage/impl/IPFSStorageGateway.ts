import { StorageGatewayType } from "../StorageGatewayFactory";
import type { IStorageGateway, RetrieveResult, StorageResult, StoreOptions } from "../storage";
import { create } from "kubo-rpc-client";

/**
 * IPFS storage gateway implementation
 * Uses kubo-rpc-client to interact with IPFS
 */
export class IPFSStorageGateway implements IStorageGateway {
  private client: ReturnType<typeof create> | null = null;
  private readonly ipfsUrl: string;

  constructor(ipfsUrl?: string) {
    // Default to local IPFS node, but can be configured via env var
    this.ipfsUrl = ipfsUrl || process.env.NEXT_PUBLIC_IPFS_URL || "http://localhost:5001";
  }

  private async getClient() {
    if (!this.client) {
      this.client = create({ url: this.ipfsUrl });
    }
    return this.client;
  }

  async store(data: Buffer | Uint8Array, _options?: StoreOptions): Promise<StorageResult> {
    const client = await this.getClient();
    const buffer = Buffer.from(data);

    try {
      const result = await client.add(buffer, {
        pin: true,
        cidVersion: 1,
      });

      const size = buffer.length;
      const uri = `ipfs://${result.cid.toString()}`;

      return {
        uri,
        hash: result.cid.toString(),
        size,
      };
    } catch (error) {
      throw new Error(`Failed to store data to IPFS: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async storeJson<T extends Record<string, unknown>>(json: T, _options?: StoreOptions): Promise<StorageResult> {
    const jsonString = JSON.stringify(json);
    const jsonBuffer = Buffer.from(jsonString, "utf-8");
    return this.store(jsonBuffer, {
      ..._options,
      contentType: _options?.contentType || "application/json",
    });
  }

  async retrieve(uri: string): Promise<RetrieveResult> {
    if (!uri.startsWith("ipfs://")) {
      throw new Error(`Invalid IPFS URI: ${uri}`);
    }

    const cid = uri.replace("ipfs://", "");
    const client = await this.getClient();

    try {
      const chunks: Uint8Array[] = [];
      for await (const chunk of client.cat(cid)) {
        chunks.push(chunk);
      }

      const data = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
      const size = data.length;

      // Try to detect content type from data
      let contentType: string | undefined;
      try {
        const text = data.toString("utf-8");
        JSON.parse(text);
        contentType = "application/json";
      } catch {
        // Not JSON, keep undefined
      }

      return {
        data,
        contentType,
        size,
      };
    } catch (error) {
      throw new Error(`Failed to retrieve data from IPFS: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async retrieveJson<T extends Record<string, unknown>>(uri: string): Promise<T> {
    const result = await this.retrieve(uri);
    try {
      const text =
        result.data instanceof Buffer ? result.data.toString("utf-8") : new TextDecoder().decode(result.data);
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON from IPFS: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async exists(uri: string): Promise<boolean> {
    if (!uri.startsWith("ipfs://")) {
      return false;
    }

    const cid = uri.replace("ipfs://", "");
    const client = await this.getClient();

    try {
      // Try to stat the CID to check if it exists
      await client.files.stat(`/ipfs/${cid}`);
      return true;
    } catch {
      // If stat fails, try to cat a small amount to verify existence
      try {
        const chunks: Uint8Array[] = [];
        for await (const chunk of client.cat(cid, { length: 1 })) {
          chunks.push(chunk);
          break; // Only need to check if we can read at least one chunk
        }
        return chunks.length > 0;
      } catch {
        return false;
      }
    }
  }

  async delete(_uri: string): Promise<boolean> {
    throw new Error("Deletion is not supported for IPFS");
  }

  getStorageType(): string {
    return StorageGatewayType.IPFS;
  }
}
