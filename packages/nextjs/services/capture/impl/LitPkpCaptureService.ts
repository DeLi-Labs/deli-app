import type { CaptureParams, CaptureResult, ICaptureService } from "../index";
import { ViemAccountAuthenticator, createAuthManager, storagePlugins } from "@lit-protocol/auth";
import { nagaDev as nagaDevContracts } from "@lit-protocol/contracts";
import { nagaDev } from "@lit-protocol/networks";
import { type Account, type Address, type Chain, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import deployedContracts from "~~/contracts/deployedContracts";
import scaffoldConfig from "~~/scaffold.config";
import type { PaymentInfoDto } from "~~/types/liquidip";
import { type LitClient, getLitClient } from "~~/utils/lit/client";

type ContractData = {
  name: string;
  contracts: Array<{
    network: string;
    address_hash: string;
    ABI: readonly unknown[];
  }>;
};

function getLitContractInfo(name: string): { address: Address; abi: readonly unknown[] } {
  const data = nagaDevContracts.data as unknown as ContractData[];
  const contract = data.find(c => c.name === name);
  if (!contract || !contract.contracts[0]) {
    throw new Error(`Contract ${name} not found in nagaDev contracts`);
  }
  return {
    address: contract.contracts[0].address_hash as Address,
    abi: contract.contracts[0].ABI,
  };
}

const LIT_APP_NAME = process.env.LIT_APP_NAME || "liquid-ip";
const LIT_NETWORK_NAME = process.env.LIT_NETWORK || "naga-dev";
const LIT_STORAGE_PATH = process.env.LIT_STORAGE_PATH || "./.lit-capture-storage";
const AUTH_DOMAIN = process.env.AUTH_DOMAIN || "localhost";

type PkpAuthContext = Awaited<ReturnType<ReturnType<typeof createAuthManager>["createPkpAuthContext"]>>;

function ensureHexPubkey(pubkey: string): `0x${string}` {
  if (pubkey.startsWith("0x")) return pubkey as `0x${string}`;
  return `0x${pubkey}` as `0x${string}`;
}

function getChain(): Chain {
  return scaffoldConfig.targetNetworks[0];
}

function getRpcUrl(chain: Chain): string {
  const rpcOverrides = scaffoldConfig.rpcOverrides as Record<number, string> | undefined;
  return rpcOverrides?.[chain.id] ?? chain.rpcUrls?.default?.http?.[0] ?? "";
}

export class LitPkpCaptureService implements ICaptureService {
  private readonly chain: Chain;
  private readonly campaignManagerAddress: Address;
  private readonly campaignManagerAbi: readonly unknown[];
  private _adminAccount: ReturnType<typeof privateKeyToAccount> | null = null;

  constructor() {
    this.chain = getChain();
    const chainContracts = (
      deployedContracts as Record<number, Record<string, { address: string; abi: readonly unknown[] }>>
    )[this.chain.id];

    const campaignManager = chainContracts?.CampaignManager;
    if (!campaignManager) {
      throw new Error(`CampaignManager not deployed on chain ${this.chain.id}`);
    }

    this.campaignManagerAddress = campaignManager.address as Address;
    this.campaignManagerAbi = campaignManager.abi;
  }

  private getAdminAccount(): ReturnType<typeof privateKeyToAccount> {
    if (this._adminAccount) return this._adminAccount;

    const adminPk = process.env.ADMIN_APP_PK;
    if (!adminPk) {
      throw new Error("ADMIN_APP_PK environment variable not set");
    }
    this._adminAccount = privateKeyToAccount(adminPk as `0x${string}`);
    return this._adminAccount;
  }

  async capture(params: CaptureParams): Promise<CaptureResult> {
    const { pkpAddress, paymentInfo, amount } = params;

    try {
      if (!pkpAddress || pkpAddress === "0x0000000000000000000000000000000000000000") {
        return { success: false, error: "PKP address not provided or is zero address" };
      }

      const pkpPubkey = await this.resolvePkpPubkeyFromAddress(pkpAddress);
      if (!pkpPubkey) {
        return { success: false, error: `Could not resolve PKP pubkey for address ${pkpAddress}` };
      }

      const litClient = await getLitClient();
      const authContext = await this.buildAdminAuthContext(litClient, pkpPubkey);

      const pkpAccount = await litClient.getPkpViemAccount({
        pkpPublicKey: ensureHexPubkey(pkpPubkey),
        authContext,
        chainConfig: this.chain,
      });

      const txHash = await this.executeCaptureTransaction(pkpAccount as Account, paymentInfo, amount);

      return { success: true, txHash };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[CaptureService] Capture failed for pkpAddress=${pkpAddress}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  private async resolvePkpPubkeyFromAddress(pkpAddress: Address): Promise<string | null> {
    try {
      const litChainConfig = nagaDev.getChainConfig();
      const publicClient = createPublicClient({
        chain: litChainConfig,
        transport: http(litChainConfig.rpcUrls.default.http[0]),
      });

      const pubkeyRouter = getLitContractInfo("PubkeyRouter");

      // First get the tokenId from the eth address
      const tokenId = await publicClient.readContract({
        address: pubkeyRouter.address,
        abi: pubkeyRouter.abi,
        functionName: "ethAddressToPkpId",
        args: [pkpAddress],
      });

      if (!tokenId || tokenId === 0n) {
        console.error(`[CaptureService] No PKP found for address ${pkpAddress}`);
        return null;
      }

      // Then get the pubkey from the tokenId
      const pubkey = await publicClient.readContract({
        address: pubkeyRouter.address,
        abi: pubkeyRouter.abi,
        functionName: "getPubkey",
        args: [tokenId],
      });

      if (!pubkey) {
        console.error(`[CaptureService] No pubkey found for tokenId ${tokenId}`);
        return null;
      }

      return pubkey as string;
    } catch (error) {
      console.error(`[CaptureService] Error resolving PKP pubkey:`, error);
      return null;
    }
  }

  private async buildAdminAuthContext(litClient: LitClient, pkpPubkey: string): Promise<PkpAuthContext> {
    const adminAccount = this.getAdminAccount();
    const authData = await ViemAccountAuthenticator.authenticate(adminAccount);

    const storage = storagePlugins.localStorageNode({
      appName: LIT_APP_NAME,
      networkName: LIT_NETWORK_NAME,
      storagePath: LIT_STORAGE_PATH,
    });

    const authManager = createAuthManager({ storage });

    const authContext = await authManager.createPkpAuthContext({
      authData,
      pkpPublicKey: ensureHexPubkey(pkpPubkey),
      authConfig: {
        resources: [
          ["pkp-signing", "*"],
          ["lit-action-execution", "*"],
        ],
        expiration: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        domain: AUTH_DOMAIN,
        statement: "",
      },
      litClient,
    });

    return authContext;
  }

  private async executeCaptureTransaction(
    pkpAccount: Account,
    paymentInfo: PaymentInfoDto,
    amount: bigint,
  ): Promise<`0x${string}`> {
    const rpcUrl = getRpcUrl(this.chain);

    const walletClient = createWalletClient({
      account: pkpAccount,
      chain: this.chain,
      transport: http(rpcUrl),
    });

    const paymentInfoStruct = {
      operator: paymentInfo.operator,
      payer: paymentInfo.payer,
      receiver: paymentInfo.receiver,
      token: paymentInfo.token,
      maxAmount: BigInt(paymentInfo.maxAmount),
      preApprovalExpiry: Number(paymentInfo.preApprovalExpiry),
      authorizationExpiry: Number(paymentInfo.authorizationExpiry),
      refundExpiry: Number(paymentInfo.refundExpiry),
      minFeeBps: paymentInfo.minFeeBps,
      maxFeeBps: paymentInfo.maxFeeBps,
      feeReceiver: paymentInfo.feeReceiver,
      salt: BigInt(paymentInfo.salt),
    };

    const txHash = await walletClient.writeContract({
      address: this.campaignManagerAddress,
      abi: this.campaignManagerAbi,
      functionName: "capture",
      args: [paymentInfoStruct, amount],
    });

    return txHash;
  }
}
