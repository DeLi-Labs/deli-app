import { createLitAuthenticator } from "../authenticator/LitAuthenticatorFactory";
import type { ILitAuthenticator } from "../authenticator/authenticator";
import { getPkpSessionStore } from "../session/PkpSessionStoreFactory";
import type { IPkpSessionStore } from "../session/session";
import { createAuthStorage } from "../storage/AuthStorageFactory";
import type { IAuthStorage } from "../storage/storage";
import { SESSION_EXPIRY_MS, buildPkpAuthContext } from "../utils";
import { RainbowKitWalletType, TypeToId, TypeToName } from "../wallet/types";
import type { ILitConnector } from "./connector";
import type { WalletDetailsParams } from "@rainbow-me/rainbowkit";
import { SwitchChainError, createWalletClient, custom, fromHex, getAddress, http } from "viem";
import { getHttpRpcClient, hexToBigInt, hexToNumber } from "viem/utils";
import type { CreateConnectorFn } from "wagmi";
import { createConnector, normalizeChainId } from "wagmi";
import { getPKP } from "~~/utils/auth";
import { getLitClient } from "~~/utils/lit/client";

type WagmiConnectorConfig = Parameters<Parameters<typeof createConnector>[0]>[0];

export class RainbowKitConnector implements ILitConnector {
  private readonly sessionStore: IPkpSessionStore;
  private readonly authenticator: ILitAuthenticator;
  private readonly authStorage: IAuthStorage;
  private readonly id: string;
  private readonly name: string;

  constructor(type: RainbowKitWalletType) {
    this.authStorage = createAuthStorage(type);
    this.authenticator = createLitAuthenticator(type);
    this.sessionStore = getPkpSessionStore(this.authStorage, `lit_${type}_pkp_info`, `lit_${type}_pkp_session_expiry`);
    this.id = TypeToId[type];
    this.name = TypeToName[type];
  }

  createConnector = (walletDetails: WalletDetailsParams): CreateConnectorFn => {
    return createConnector(config => ({
      ...this.impl(config),
      ...walletDetails,
    }));
  };

  /**
   * Authenticate via the provider (e.g. Google popup), fetch/mint a PKP,
   * build a Lit auth context, and persist the session.
   */
  private async authenticateAndSetSession(): Promise<void> {
    const authData = await this.authenticator.authenticate();
    await this.authStorage.set(authData);

    const litClient = await getLitClient();
    const pkpInfo = await getPKP(authData, litClient);
    const authContext = await buildPkpAuthContext(authData, pkpInfo.pubkey);

    this.sessionStore.setPkpSession(pkpInfo, authContext, Date.now() + SESSION_EXPIRY_MS);
  }

  private impl(config: WagmiConnectorConfig): ReturnType<CreateConnectorFn> {
    const sessionStore = this.sessionStore;
    const authenticate = () => this.authenticateAndSetSession();
    let connectedChainId: number;

    return {
      id: this.id,
      name: this.name,
      type: this.id,

      async connect(parameters?) {
        const { chainId, withCapabilities } = parameters ?? {};
        const targetChainId = chainId ?? config.chains[0].id;

        if (!sessionStore.isSessionValid()) {
          await authenticate();
        }

        await sessionStore.getPkpAccount(targetChainId);
        connectedChainId = targetChainId;

        const accounts = await this.getAccounts();

        if (withCapabilities) {
          return {
            accounts: accounts.map(address => ({
              address,
              capabilities: {} as Record<string, unknown>,
            })),
            chainId: connectedChainId,
          } as any;
        }

        return { accounts, chainId: connectedChainId } as any;
      },

      async getProvider({ chainId } = {}) {
        const targetChainId = chainId ?? connectedChainId;
        const chain = config.chains.find(x => x.id === targetChainId) ?? config.chains[0];
        const url = chain.rpcUrls.default.http[0];
        if (!url) throw new Error("No RPC URL for chain");
        const pkpAccount = await sessionStore.getPkpAccount(targetChainId);

        const client = createWalletClient({
          chain,
          account: pkpAccount,
          transport: http(url),
        });

        const request = async ({ method, params }: { method: string; params?: unknown[] }) => {
          const p = (params ?? []) as unknown[];
          if (method === "eth_sendTransaction") {
            const actualParams = p[0] as {
              data?: `0x${string}`;
              to?: `0x${string}`;
              value?: `0x${string}`;
              gas?: `0x${string}`;
              nonce?: `0x${string}`;
              maxPriorityFeePerGas?: `0x${string}`;
              maxFeePerGas?: `0x${string}`;
              gasPrice?: `0x${string}`;
            };
            const hasEip1559 =
              actualParams?.maxPriorityFeePerGas !== undefined || actualParams?.maxFeePerGas !== undefined;
            return client.sendTransaction({
              account: pkpAccount,
              data: actualParams?.data,
              to: actualParams?.to,
              value: actualParams?.value ? hexToBigInt(actualParams.value) : undefined,
              gas: actualParams?.gas ? hexToBigInt(actualParams.gas) : undefined,
              nonce: actualParams?.nonce ? hexToNumber(actualParams.nonce) : undefined,
              ...(hasEip1559
                ? {
                    maxPriorityFeePerGas: actualParams?.maxPriorityFeePerGas
                      ? hexToBigInt(actualParams.maxPriorityFeePerGas)
                      : undefined,
                    maxFeePerGas: actualParams?.maxFeePerGas ? hexToBigInt(actualParams.maxFeePerGas) : undefined,
                  }
                : {
                    gasPrice: actualParams?.gasPrice ? hexToBigInt(actualParams.gasPrice) : undefined,
                  }),
            });
          }
          if (method === "personal_sign") {
            const rawMessage = p[0] as `0x${string}`;
            return client.signMessage({
              account: pkpAccount,
              message: { raw: rawMessage },
            });
          }
          if (method === "eth_signTypedData_v4") {
            const stringifiedData = p[1] as string;
            return client.signTypedData(JSON.parse(stringifiedData) as Parameters<typeof client.signTypedData>[0]);
          }
          if (method === "eth_accounts") {
            return [pkpAccount.address];
          }
          if (method === "wallet_switchEthereumChain") {
            connectedChainId = fromHex((p[0] as { chainId: `0x${string}` }).chainId, "number");
            this.onChainChanged(connectedChainId.toString());
            return null;
          }
          const body = { method, params: p };
          const httpClient = getHttpRpcClient(url);
          const { error, result } = await httpClient.request({ body });
          if (error) throw error;
          return result;
        };

        return custom({ request })({ retryCount: 0 });
      },

      async getAccounts() {
        const addr = sessionStore.getPkpAddress();
        if (!addr) throw new Error("PKP not connected");
        return [getAddress(addr)];
      },

      async getChainId() {
        return connectedChainId;
      },

      async isAuthorized() {
        return sessionStore.isSessionValid() && sessionStore.getPkpAddress() !== null;
      },

      async switchChain({ chainId }) {
        const chain = config.chains.find(x => x.id === chainId);
        if (!chain) throw new SwitchChainError(new Error("Chain not configured"));
        await sessionStore.getPkpAccount(chainId);
        connectedChainId = chainId;
        this.onChainChanged(chainId.toString());
        return chain;
      },

      async disconnect() {
        sessionStore.clearSession();
        config.emitter.emit("disconnect");
      },

      onChainChanged(chain: string) {
        config.emitter.emit("change", { chainId: normalizeChainId(chain) });
      },

      onAccountsChanged(accounts: `0x${string}`[]) {
        config.emitter.emit("change", { accounts: accounts.map(getAddress) });
      },

      onDisconnect() {
        config.emitter.emit("disconnect");
      },
    };
  }
}
