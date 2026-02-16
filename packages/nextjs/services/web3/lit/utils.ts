import { createAuthManager, storagePlugins } from "@lit-protocol/auth";
import type { AuthData } from "@lit-protocol/schemas";
import { getLitClient } from "~~/utils/lit/client";

export const SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export const LIT_APP_NAME = "liquid-ip";
export const LIT_NETWORK_NAME = "naga-dev";

export function ensureHexPubkey(pubkey: string): `0x${string}` {
  if (pubkey.startsWith("0x")) return pubkey as `0x${string}`;
  return `0x${pubkey}` as `0x${string}`;
}

export type PkpAuthContext = Awaited<ReturnType<ReturnType<typeof createAuthManager>["createPkpAuthContext"]>>;

/**
 * Build a Lit PKP auth context from auth data and a PKP public key.
 * Shared between session rebuild (PkpSessionStore) and fresh auth (RainbowKitConnector).
 */
export async function buildPkpAuthContext(authData: AuthData, pkpPublicKey: string): Promise<PkpAuthContext> {
  const litClient = await getLitClient();
  const storage = storagePlugins.localStorage({
    appName: LIT_APP_NAME,
    networkName: LIT_NETWORK_NAME,
  });
  const authManager = createAuthManager({ storage });
  return authManager.createPkpAuthContext({
    authData,
    pkpPublicKey: ensureHexPubkey(pkpPublicKey),
    authConfig: {
      resources: [
        ["pkp-signing", "*"],
        ["lit-action-execution", "*"],
      ],
      expiration: new Date(Date.now() + SESSION_EXPIRY_MS).toISOString(),
      domain:
        typeof window !== "undefined" ? (window.location?.origin ?? "http://localhost:3000") : "http://localhost:3000",
      statement: "",
    },
    litClient,
  });
}
