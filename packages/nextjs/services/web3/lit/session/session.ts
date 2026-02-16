import type { PkpAuthContext } from "../utils";
import type { Account } from "viem";
import type { PKPInfo } from "~~/utils/auth";

export type { PkpAuthContext };

export interface IPkpSessionStore {
  isSessionValid(): boolean;
  setPkpSession(pkpInfo: PKPInfo, authContext: PkpAuthContext, expiresAt: number): void;
  getPkpAccount(chainId: number): Promise<Account>;
  getPkpAddress(): `0x${string}` | null;
  clearSession(): void;
}
