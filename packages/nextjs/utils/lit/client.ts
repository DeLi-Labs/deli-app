/**
 * Shared singleton Lit Protocol client.
 *
 * Both the cipher gateway and the API handler need access to a connected
 * Lit client (for encrypt/decrypt and for getContext().latestBlockhash
 * respectively). This module ensures only one connection is made.
 */
import { createLitClient } from "@lit-protocol/lit-client";
import { nagaDev } from "@lit-protocol/networks";

export type LitClient = Awaited<ReturnType<typeof createLitClient>>;

export type SessionKeyPair = {
  publicKey: string;
  secretKey: string;
};

let litClient: LitClient | null = null;
let connecting: Promise<LitClient> | null = null;

export async function getLitClient(): Promise<LitClient> {
  if (litClient) return litClient;

  // Prevent multiple simultaneous connections
  if (connecting) return connecting;

  connecting = createLitClient({ network: nagaDev })
    .then(client => {
      litClient = client;
      connecting = null;
      return client;
    })
    .catch(err => {
      connecting = null; // Allow retry on next call
      throw err;
    });

  return connecting;
}
