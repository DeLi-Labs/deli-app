/**
 * Per-wallet-type PKP session store. Bridge between the wagmi connector (no React)
 * and future LitPkpProvider (React). No React imports.
 */
import type { IAuthStorage } from "../storage/storage";
import { buildPkpAuthContext, ensureHexPubkey } from "../utils";
import type { IPkpSessionStore, PkpAuthContext } from "./session";
import type { Account } from "viem";
import scaffoldConfig from "~~/scaffold.config";
import type { PKPInfo } from "~~/utils/auth";
import { getLitClient } from "~~/utils/lit/client";

function getChainById(chainId: number) {
  const chain = scaffoldConfig.targetNetworks.find(c => c.id === chainId);
  if (!chain) {
    throw new Error(`Chain ${chainId} is not in targetNetworks`);
  }
  return chain;
}

export class PkpSessionStore implements IPkpSessionStore {
  private readonly storage: IAuthStorage;
  private readonly pkpInfoKey: string;
  private readonly sessionExpiryKey: string;

  private readonly accountsByChain = new Map<number, Account>();
  private currentAuthContext: PkpAuthContext | null = null;
  private currentPkpInfo: PKPInfo | null = null;

  constructor(storage: IAuthStorage, pkpInfoKey: string, sessionExpiryKey: string) {
    this.storage = storage;
    this.pkpInfoKey = pkpInfoKey;
    this.sessionExpiryKey = sessionExpiryKey;
  }

  isSessionValid(): boolean {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(this.pkpInfoKey);
    const expiry = localStorage.getItem(this.sessionExpiryKey);
    if (!stored || !expiry) return false;
    return Date.now() < parseInt(expiry, 10);
  }

  setPkpSession(pkpInfo: PKPInfo, authContext: PkpAuthContext, expiresAt: number): void {
    this.currentPkpInfo = pkpInfo;
    this.currentAuthContext = authContext;
    this.accountsByChain.clear();
    localStorage.setItem(this.pkpInfoKey, JSON.stringify(pkpInfo));
    localStorage.setItem(this.sessionExpiryKey, expiresAt.toString());
  }

  private async rebuildAuthContext(): Promise<void> {
    let authData;
    try {
      authData = await this.storage.get();
    } catch {
      this.clearSession();
      return;
    }

    const pkpInfoRaw = typeof window !== "undefined" ? localStorage.getItem(this.pkpInfoKey) : null;
    if (!authData || !pkpInfoRaw) {
      this.clearSession();
      return;
    }

    const pkpInfo: PKPInfo = JSON.parse(pkpInfoRaw);
    try {
      const authContext = await buildPkpAuthContext(authData, pkpInfo.pubkey);
      this.currentPkpInfo = pkpInfo;
      this.currentAuthContext = authContext;
    } catch (err) {
      console.error("Failed to rebuild PKP auth context:", err);
      this.clearSession();
    }
  }

  async getPkpAccount(chainId: number): Promise<Account> {
    const cached = this.accountsByChain.get(chainId);
    if (cached && this.isSessionValid()) {
      return cached;
    }

    if (this.isSessionValid() && !this.currentAuthContext) {
      await this.rebuildAuthContext();
    }

    if (!this.currentAuthContext || !this.currentPkpInfo) {
      throw new Error("PKP session not set");
    }

    const litClient = await getLitClient();
    const chain = getChainById(chainId);
    const account = await litClient.getPkpViemAccount({
      pkpPublicKey: ensureHexPubkey(this.currentPkpInfo.pubkey),
      authContext: this.currentAuthContext,
      chainConfig: chain,
    });
    this.accountsByChain.set(chainId, account);
    return account;
  }

  getPkpAddress(): `0x${string}` | null {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(this.pkpInfoKey);
    if (!stored) return null;
    const info: PKPInfo = JSON.parse(stored);
    const addr = info.ethAddress;
    if (!addr) return null;
    return addr.startsWith("0x") ? (addr as `0x${string}`) : (`0x${addr}` as `0x${string}`);
  }

  clearSession(): void {
    this.currentAuthContext = null;
    this.currentPkpInfo = null;
    this.accountsByChain.clear();
    if (typeof window !== "undefined") {
      localStorage.removeItem(this.pkpInfoKey);
      localStorage.removeItem(this.sessionExpiryKey);
      void this.storage.delete();
    }
  }
}
