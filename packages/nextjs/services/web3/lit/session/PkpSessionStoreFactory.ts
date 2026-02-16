import type { IAuthStorage } from "../storage/storage";
import { PkpSessionStore } from "./PkpSessionStore";
import type { IPkpSessionStore } from "./session";

const instances = new Map<string, IPkpSessionStore>();

/**
 * Returns a singleton PkpSessionStore per pkpInfoKey (one per wallet type).
 * Caller must pass storage and keys to avoid circular dependency on wallet/storage factories.
 */
export function getPkpSessionStore(
  storage: IAuthStorage,
  pkpInfoKey: string,
  sessionExpiryKey: string,
): IPkpSessionStore {
  let instance = instances.get(pkpInfoKey);
  if (!instance) {
    instance = new PkpSessionStore(storage, pkpInfoKey, sessionExpiryKey);
    instances.set(pkpInfoKey, instance);
  }
  return instance;
}
