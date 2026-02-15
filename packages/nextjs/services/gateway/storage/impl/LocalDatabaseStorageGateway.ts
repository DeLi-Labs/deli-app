import { StorageGatewayType } from "../StorageGatewayFactory";
import type { IStorageGateway, RetrieveResult, StorageResult, StoreOptions } from "../storage";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";

/**
 * Local database storage gateway implementation
 * Stores all data in a single JSON file
 */
export class LocalDatabaseStorageGateway implements IStorageGateway {
  private readonly storageFilePath: string;
  private storage: Map<string, StorageEntry> = new Map();
  private loadPromise: Promise<void> | null = null;

  constructor(storageFilePath?: string) {
    // Default to a storage.json file in the project root
    this.storageFilePath =
      storageFilePath || process.env.LOCAL_STORAGE_PATH || join(process.cwd(), "local-storage.json");

    // Load existing data if file exists (but don't block constructor)
    this.loadPromise = this.loadStorage().catch(error => {
      console.warn(
        `Failed to load local storage from ${this.storageFilePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  private async loadStorage(): Promise<void> {
    try {
      const data = await fs.readFile(this.storageFilePath, "utf-8");
      const parsed = JSON.parse(data) as Record<string, StorageEntry>;
      this.storage = new Map(Object.entries(parsed));
    } catch (error) {
      // File doesn't exist yet, start with empty storage
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      this.storage = new Map();
    }
  }

  private async ensureStorageLoaded(): Promise<void> {
    if (this.loadPromise) {
      await this.loadPromise;
      this.loadPromise = null; // Clear after first load
    }
  }

  private async saveStorage(): Promise<void> {
    try {
      const data = Object.fromEntries(this.storage);
      await fs.writeFile(this.storageFilePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      throw new Error(`Failed to save local storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private generateUri(data: Buffer | Uint8Array): string {
    const hash = createHash("sha256").update(data).digest("hex");
    return `local://${hash}`;
  }

  async store(data: Buffer | Uint8Array, options?: StoreOptions): Promise<StorageResult> {
    // Ensure storage is loaded before storing
    await this.ensureStorageLoaded();

    const buffer = Buffer.from(data);
    const uri = this.generateUri(buffer);
    const hash = createHash("sha256").update(buffer).digest("hex");
    const size = buffer.length;

    const entry: StorageEntry = {
      data: buffer.toString("base64"),
      contentType: options?.contentType,
      size,
      metadata: options?.metadata,
      createdAt: new Date().toISOString(),
    };

    this.storage.set(uri, entry);
    await this.saveStorage();

    return {
      uri,
      hash,
      size,
    };
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
    if (!uri.startsWith("local://")) {
      throw new Error(`Invalid local storage URI: ${uri}`);
    }

    // Ensure storage is loaded before retrieving
    await this.ensureStorageLoaded();

    // If not found, try reloading the file (in case it was updated)
    let entry = this.storage.get(uri);
    if (!entry) {
      console.log(`[LocalStorageGateway] Entry not found in memory, reloading storage from ${this.storageFilePath}`);
      await this.loadStorage();
      entry = this.storage.get(uri);
    }

    if (!entry) {
      throw new Error(`Content not found: ${uri}`);
    }

    const data = Buffer.from(entry.data, "base64");

    return {
      data,
      contentType: entry.contentType,
      size: entry.size,
      metadata: entry.metadata,
    };
  }

  async retrieveJson<T extends Record<string, unknown>>(uri: string): Promise<T> {
    const result = await this.retrieve(uri);
    try {
      const text =
        result.data instanceof Buffer ? result.data.toString("utf-8") : new TextDecoder().decode(result.data);
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse JSON from local storage: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async exists(uri: string): Promise<boolean> {
    if (!uri.startsWith("local://")) {
      return false;
    }
    await this.ensureStorageLoaded();
    return this.storage.has(uri);
  }

  async delete(uri: string): Promise<boolean> {
    if (!uri.startsWith("local://")) {
      return false;
    }

    const deleted = this.storage.delete(uri);
    if (deleted) {
      await this.saveStorage();
    }
    return deleted;
  }

  getStorageType(): string {
    return StorageGatewayType.LOCAL;
  }
}

/**
 * Internal storage entry structure
 */
interface StorageEntry {
  data: string; // Base64 encoded data
  contentType?: string;
  size: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
