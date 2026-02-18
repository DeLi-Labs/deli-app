import type {
  DecryptOptions,
  DecryptionResult,
  EncryptOptions,
  EncryptableData,
  EncryptionResult,
  ICipherGateway,
} from "../cipher";
import { EncryptedData } from "../cipher";
import type { AccessControlConditions } from "@lit-protocol/types";
import { type PublicClient, createPublicClient, encodeAbiParameters, http, keccak256 } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import externalContracts from "~~/contracts/externalContracts";
import scaffoldConfig from "~~/scaffold.config";
import { buildAuthContextForDecrypt } from "~~/utils/auth";
import { getLitClient } from "~~/utils/lit/client";

/** Default ACC used for encrypt/decrypt; export so attachment provider can compute resourceId for 401 challenge. */
export const DEFAULT_ACCESS_CONTROL_CONDITIONS: AccessControlConditions = [
  {
    contractAddress: "",
    standardContractType: "",
    chain: "ethereum",
    method: "eth_getBalance",
    parameters: [":userAddress", "latest"],
    returnValueTest: {
      comparator: ">=",
      value: "0",
    },
  },
];

type ContractEntry = { address: string; abi: readonly unknown[] };

export class LocalCipherGatewayFrontend implements ICipherGateway {
  private accessControlConditions: AccessControlConditions = DEFAULT_ACCESS_CONTROL_CONDITIONS;

  private readonly chainId: number;
  private readonly client: PublicClient | null;
  private readonly authCaptureEscrowContract: ContractEntry | null;
  private readonly authCaptureEscrowAddrPromise: Promise<`0x${string}` | null>;

  constructor() {
    this.chainId = scaffoldConfig.targetNetworks[0].id;
    const chainId = this.chainId;
    const chain = scaffoldConfig.targetNetworks.find(n => n.id === chainId) ?? null;
    const rpcOverrides = scaffoldConfig.rpcOverrides as Record<number, string> | undefined;
    const rpcUrl = chain ? (rpcOverrides?.[chainId] ?? chain.rpcUrls?.default?.http?.[0]) : undefined;

    this.client = chain && rpcUrl ? createPublicClient({ chain, transport: http(rpcUrl) }) : null;

    const chainContracts = (deployedContracts as Record<number, Record<string, ContractEntry>>)[chainId];
    const campaignManagerContract = chainContracts?.CampaignManager ?? null;
    const externalChainContracts = (externalContracts as Record<number, Record<string, ContractEntry>>)[chainId];
    this.authCaptureEscrowContract = externalChainContracts?.AuthCaptureEscrow ?? null;

    this.authCaptureEscrowAddrPromise =
      this.client && campaignManagerContract
        ? this.client
            .readContract({
              address: campaignManagerContract.address as `0x${string}`,
              abi: campaignManagerContract.abi,
              functionName: "authCaptureEscrow",
            })
            .then(addr => addr as `0x${string}`)
        : Promise.resolve(null);
  }

  /**
   * Convert various data types to Uint8Array
   */
  private async dataToUint8Array(data: EncryptableData): Promise<Uint8Array> {
    if (data instanceof Uint8Array) {
      return data;
    }

    if (typeof data === "string") {
      return new TextEncoder().encode(data);
    }

    if (data instanceof File || data instanceof Blob) {
      const arrayBuffer = await data.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    throw new Error(`Unsupported data type: ${typeof data}`);
  }

  async encrypt(data: EncryptableData, options?: EncryptOptions): Promise<EncryptionResult> {
    const litClient = await getLitClient();
    const dataUint8Array = await this.dataToUint8Array(data);

    const accessControlConditions = this.accessControlConditions.map((condition, index) => ({
      ...condition,
      chain: options?.chain || this.accessControlConditions[index].chain,
    }));

    const encryptResponse = await litClient.encrypt({
      dataToEncrypt: dataUint8Array,
      accessControlConditions: accessControlConditions,
    });

    const encryptedData = new EncryptedData(
      encryptResponse.ciphertext,
      encryptResponse.dataToEncryptHash,
      options?.metadata || {},
    );

    return {
      ciphertext: encryptedData,
    };
  }

  async decrypt(encryptedData: EncryptedData, options: DecryptOptions): Promise<DecryptionResult> {
    const litClient = await getLitClient();

    const authContext = await buildAuthContextForDecrypt(
      this.accessControlConditions,
      encryptedData.getHash().toString(),
      options.auth.authSig,
      options.auth.sessionKeyPair,
      options.domain,
    );

    const authorized = await this.verifyAuthorizationAmount(
      options.auth.requiredAuthorizedAmount,
      options.auth.paymentInfoHash,
    );
    if (!authorized) {
      throw new Error(
        "Authorization amount not met. Please authorize the payment for attachment decryption using /api/ip/[tokenId]/[campaignId]/[attachmentId]/prepareAuthorize",
      );
    }

    const ciphertext = new TextDecoder().decode(encryptedData.getData());
    const dataToEncryptHash = encryptedData.getHash();

    const decryptResponse = await litClient.decrypt({
      ciphertext,
      dataToEncryptHash,
      accessControlConditions: this.accessControlConditions,
      authContext: authContext,
    });

    return {
      decryptedData: decryptResponse.decryptedData,
      metadata: encryptedData.getMetadata(),
    };
  }

  /**
   * Compute the same key the contract uses for paymentState.
   * AuthCaptureEscrow.getHash: keccak256(abi.encode(chainId, address(this), innerPaymentInfoHash)).
   */
  private async getPaymentStateKey(innerPaymentInfoHash: string): Promise<`0x${string}`> {
    const authCaptureEscrowAddr = await this.authCaptureEscrowAddrPromise;
    if (!authCaptureEscrowAddr) throw new Error("AuthCaptureEscrow address not available");
    const innerHashBytes32 = innerPaymentInfoHash.startsWith("0x")
      ? (innerPaymentInfoHash as `0x${string}`)
      : (`0x${innerPaymentInfoHash}` as `0x${string}`);
    const outerHash = keccak256(
      encodeAbiParameters(
        [{ type: "uint256" }, { type: "address" }, { type: "bytes32" }],
        [BigInt(this.chainId), authCaptureEscrowAddr, innerHashBytes32],
      ),
    );
    return outerHash;
  }

  private async verifyAuthorizationAmount(requiredAuthorizedAmount: number, paymentInfoHash: string): Promise<boolean> {
    const authCaptureEscrowAddr = await this.authCaptureEscrowAddrPromise;
    if (!this.client || !authCaptureEscrowAddr || !this.authCaptureEscrowContract) {
      return false;
    }

    const paymentStateKey = await this.getPaymentStateKey(paymentInfoHash);
    const state = await this.client.readContract({
      address: authCaptureEscrowAddr,
      abi: this.authCaptureEscrowContract.abi,
      functionName: "paymentState",
      args: [paymentStateKey],
    });

    const capturableAmount = Array.isArray(state) ? state[1] : (state as { capturableAmount: bigint }).capturableAmount;
    return BigInt(capturableAmount) >= BigInt(requiredAuthorizedAmount);
  }
}
