import { type Address, createPublicClient, encodeAbiParameters, encodeFunctionData, http, keccak256 } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import externalContracts from "~~/contracts/externalContracts";
import scaffoldConfig from "~~/scaffold.config";
import { createIndexerGateway } from "~~/services/gateway/indexer/IndexerGatewayFactory";
import { createStorageGateway } from "~~/services/gateway/storage/StorageGatewayFactory";
import type {
  Campaign,
  CampaignUploadFormData,
  PaymentInfoDto,
  PermitMessage,
  PermitSingle,
  PermitTransferFromMessage,
} from "~~/types/liquidip";

const TICK_SPACING = 30;

// Must match AuthCaptureEscrow.PAYMENT_INFO_TYPEHASH
const PAYMENT_INFO_TYPEHASH = keccak256(
  new TextEncoder().encode(
    "PaymentInfo(address operator,address payer,address receiver,address token,uint120 maxAmount,uint48 preApprovalExpiry,uint48 authorizationExpiry,uint48 refundExpiry,uint16 minFeeBps,uint16 maxFeeBps,address feeReceiver,uint256 salt)",
  ),
);

// Must match CampaignManager constants
const PRE_APPROVAL_EXPIRY = 86400; // 1 day in seconds
const AUTHORIZATION_EXPIRY = 86400;
const REFUND_EXPIRY = 86400;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

function getPublicClient(chainId: number) {
  const chain = scaffoldConfig.targetNetworks.find(n => n.id === chainId);
  if (!chain) {
    throw new Error(`Chain ${chainId} not found in scaffold config`);
  }

  const rpcOverrides = scaffoldConfig.rpcOverrides as Record<number, string> | undefined;
  const rpcUrl = rpcOverrides?.[chainId] ?? chain.rpcUrls?.default?.http?.[0];

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

function getPoolKey(campaign: Campaign, hookAddress: `0x${string}`) {
  return {
    currency0: campaign.numeraireAddress as `0x${string}`,
    currency1: campaign.licenseAddress as `0x${string}`,
    fee: 0,
    tickSpacing: TICK_SPACING as 30,
    hooks: hookAddress,
  };
}

export class CampaignProvider {
  private indexerGateway = createIndexerGateway();
  private storageGateway = createStorageGateway();
  private readonly defaultChainId: number;
  private readonly defaultHookContract: { address: string; abi: readonly unknown[] };
  private readonly defaultRouterContract: { address: string; abi: readonly unknown[] };
  private readonly defaultCampaignManagerContract: { address: string; abi: readonly unknown[] };
  private readonly permit2Contract: { address: string; abi: readonly unknown[] };
  private readonly permit2Address: Address;

  constructor() {
    this.defaultChainId = scaffoldConfig.targetNetworks[0].id;
    const chainContracts = (
      deployedContracts as Record<number, Record<string, { address: string; abi: readonly unknown[] }>>
    )[this.defaultChainId];
    const hookContract = chainContracts?.FixedPriceLicenseHook;
    if (!hookContract) {
      throw new Error(`FixedPriceLicenseHook not deployed on chain ${this.defaultChainId}`);
    }
    this.defaultHookContract = hookContract;

    const routerContract = chainContracts?.FixedPriceSwapRouter;
    if (!routerContract) {
      throw new Error(`FixedPriceSwapRouter not deployed on chain ${this.defaultChainId}`);
    }
    this.defaultRouterContract = routerContract;

    const campaignManagerContract = chainContracts?.CampaignManager;
    if (!campaignManagerContract) {
      throw new Error(`CampaignManager not deployed on chain ${this.defaultChainId}`);
    }
    this.defaultCampaignManagerContract = campaignManagerContract;

    // Get Permit2 contract from external contracts
    const externalChainContracts = (
      externalContracts as Record<number, Record<string, { address: string; abi: readonly unknown[] }>>
    )[this.defaultChainId];
    const permit2Contract = externalChainContracts?.Permit2;
    if (!permit2Contract) {
      throw new Error(`Permit2 not configured for chain ${this.defaultChainId}`);
    }
    this.permit2Contract = permit2Contract;
    this.permit2Address = permit2Contract.address as Address;
  }

  async getCampaignDetails(tokenId: number, licenseAddress: string): Promise<Campaign | null> {
    return this.indexerGateway.getCampaignDetails(tokenId, licenseAddress);
  }

  async getQuoteExactOutput(campaign: Campaign, amountOutRaw: bigint): Promise<bigint> {
    const client = getPublicClient(this.defaultChainId);
    const poolId = campaign.poolId as `0x${string}`;

    const amountIn = await client.readContract({
      address: this.defaultHookContract.address as `0x${string}`,
      abi: [...this.defaultHookContract.abi],
      functionName: "getQuote",
      args: [poolId, amountOutRaw, true, true],
    });

    return BigInt(amountIn as bigint);
  }

  /**
   * Encode swap transaction with Permit2 permit data.
   * Backend always requires Permit2 permits - direct approvals are not supported.
   */
  encodeSwapExactOutputSingle(
    campaign: Campaign,
    amountOut: bigint,
    amountInMaximum: bigint,
    permitSingle: PermitSingle,
    permitSignature: `0x${string}`,
  ): `0x${string}` {
    const poolKey = getPoolKey(campaign, this.defaultHookContract.address as `0x${string}`);

    return encodeFunctionData({
      abi: [...this.defaultRouterContract.abi],
      functionName: "swapExactOutputSingle",
      args: [poolKey, amountOut, amountInMaximum, true, "0x" as `0x${string}`, permitSingle, permitSignature],
    });
  }

  /**
   * Get the current nonce for a user/token/spender combination from Permit2
   */
  async getPermit2Nonce(userAddress: Address, tokenAddress: Address, spenderAddress: Address): Promise<bigint> {
    const client = getPublicClient(this.defaultChainId);

    const allowance = await client.readContract({
      address: this.permit2Address,
      abi: [...this.permit2Contract.abi],
      functionName: "allowance",
      args: [userAddress, tokenAddress, spenderAddress],
    });

    // allowance returns [amount, expiration, nonce]
    return BigInt((allowance as readonly [bigint, bigint, bigint])[2]);
  }

  /**
   * Create a Permit2 permit message for EIP-712 signing
   * Note: The domain separator is computed automatically by the signing library from the domain fields
   */
  async createPermitMessage(
    userAddress: Address,
    tokenAddress: Address,
    amount: bigint,
    spenderAddress: Address,
    deadline: bigint,
  ): Promise<PermitMessage> {
    const nonce = await this.getPermit2Nonce(userAddress, tokenAddress, spenderAddress);

    // Calculate expiration: 30 days from now (in seconds)
    const expiration = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);

    return {
      domain: {
        name: "Permit2",
        chainId: this.defaultChainId,
        verifyingContract: this.permit2Address,
      },
      types: {
        PermitSingle: [
          { name: "details", type: "PermitDetails" },
          { name: "spender", type: "address" },
          { name: "sigDeadline", type: "uint256" },
        ],
        PermitDetails: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint160" },
          { name: "expiration", type: "uint48" },
          { name: "nonce", type: "uint48" },
        ],
      },
      primaryType: "PermitSingle",
      message: {
        details: {
          token: tokenAddress,
          amount: amount.toString(), // uint160 as string
          expiration: expiration.toString(), // uint48 as string
          nonce: nonce.toString(), // uint48 as string
        },
        spender: spenderAddress,
        sigDeadline: deadline.toString(), // uint256 as string
      },
    };
  }

  /**
   * Get the Permit2PaymentCollector address from CampaignManager
   */
  async getPermit2TokenCollectorAddress(campaignManagerAddress: Address): Promise<Address> {
    const client = getPublicClient(this.defaultChainId);
    const permit2TokenCollector = await client.readContract({
      address: campaignManagerAddress,
      abi: [...this.defaultCampaignManagerContract.abi],
      functionName: "permit2TokenCollector",
    });
    return permit2TokenCollector as Address;
  }

  /**
   * Build a PaymentInfo struct for the authorize flow.
   * Reads treasuryManager and saltIndex from the CampaignManager contract.
   */
  async buildPaymentInfo(userAddress: Address, licenseAddress: Address, amountRaw: bigint): Promise<PaymentInfoDto> {
    const client = getPublicClient(this.defaultChainId);
    const campaignManagerAddr = this.defaultCampaignManagerContract.address as Address;
    const abi = [...this.defaultCampaignManagerContract.abi];

    const [treasuryManager, saltIndex] = await Promise.all([
      client.readContract({ address: campaignManagerAddr, abi, functionName: "treasuryManager" }),
      client.readContract({ address: campaignManagerAddr, abi, functionName: "saltIndex" }),
    ]);

    const now = Math.floor(Date.now() / 1000);

    return {
      operator: campaignManagerAddr,
      payer: userAddress,
      receiver: treasuryManager as Address,
      token: licenseAddress,
      maxAmount: amountRaw.toString(),
      preApprovalExpiry: (now + PRE_APPROVAL_EXPIRY).toString(),
      authorizationExpiry: (now + AUTHORIZATION_EXPIRY).toString(),
      refundExpiry: (now + REFUND_EXPIRY).toString(),
      minFeeBps: 0,
      maxFeeBps: 0,
      feeReceiver: ZERO_ADDRESS,
      salt: (saltIndex as bigint).toString(),
    };
  }

  /**
   * Compute the payer-agnostic hash of a PaymentInfo struct.
   * Mirrors TokenCollector._getHashPayerAgnostic and AuthCaptureEscrow.getHash.
   */
  async computePayerAgnosticHash(paymentInfo: PaymentInfoDto): Promise<bigint> {
    const client = getPublicClient(this.defaultChainId);
    const campaignManagerAddr = this.defaultCampaignManagerContract.address as Address;

    // Read authCaptureEscrow address from CampaignManager
    const authCaptureEscrowAddr = (await client.readContract({
      address: campaignManagerAddr,
      abi: [...this.defaultCampaignManagerContract.abi],
      functionName: "authCaptureEscrow",
    })) as Address;

    // Encode PaymentInfo with payer = address(0) (payer-agnostic)
    const paymentInfoEncoded = encodeAbiParameters(
      [
        { type: "bytes32" }, // PAYMENT_INFO_TYPEHASH
        { type: "address" }, // operator
        { type: "address" }, // payer (zeroed)
        { type: "address" }, // receiver
        { type: "address" }, // token
        { type: "uint120" }, // maxAmount
        { type: "uint48" }, // preApprovalExpiry
        { type: "uint48" }, // authorizationExpiry
        { type: "uint48" }, // refundExpiry
        { type: "uint16" }, // minFeeBps
        { type: "uint16" }, // maxFeeBps
        { type: "address" }, // feeReceiver
        { type: "uint256" }, // salt
      ],
      [
        PAYMENT_INFO_TYPEHASH,
        paymentInfo.operator,
        ZERO_ADDRESS, // payer-agnostic: replace payer with address(0)
        paymentInfo.receiver,
        paymentInfo.token,
        BigInt(paymentInfo.maxAmount),
        Number(paymentInfo.preApprovalExpiry),
        Number(paymentInfo.authorizationExpiry),
        Number(paymentInfo.refundExpiry),
        paymentInfo.minFeeBps,
        paymentInfo.maxFeeBps,
        paymentInfo.feeReceiver,
        BigInt(paymentInfo.salt),
      ],
    );

    const paymentInfoHash = keccak256(paymentInfoEncoded);

    // Mirrors: keccak256(abi.encode(block.chainid, address(authCaptureEscrow), paymentInfoHash))
    const finalHash = keccak256(
      encodeAbiParameters(
        [{ type: "uint256" }, { type: "address" }, { type: "bytes32" }],
        [BigInt(this.defaultChainId), authCaptureEscrowAddr, paymentInfoHash],
      ),
    );

    return BigInt(finalHash);
  }

  /**
   * Create a PermitTransferFrom message for EIP-712 signing (SignatureTransfer).
   * Used for the authorize flow with Permit2PaymentCollector.
   */
  async createPermitTransferFromMessage(
    paymentInfo: PaymentInfoDto,
    permit2TokenCollectorAddr: Address,
  ): Promise<PermitTransferFromMessage> {
    const nonce = await this.computePayerAgnosticHash(paymentInfo);

    return {
      domain: {
        name: "Permit2",
        chainId: this.defaultChainId,
        verifyingContract: this.permit2Address,
      },
      types: {
        PermitTransferFrom: [
          { name: "permitted", type: "TokenPermissions" },
          { name: "spender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        TokenPermissions: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
      primaryType: "PermitTransferFrom",
      message: {
        permitted: {
          token: paymentInfo.token,
          amount: paymentInfo.maxAmount,
        },
        spender: permit2TokenCollectorAddr,
        nonce: nonce.toString(),
        deadline: paymentInfo.preApprovalExpiry,
      },
    };
  }

  /**
   * Encode authorize transaction with PaymentInfo and Permit2 collectorData (signature).
   * Matches the new authorize(PaymentInfo, bytes) signature.
   */
  encodeAuthorizeWithPermit(paymentInfo: PaymentInfoDto, collectorData: `0x${string}`): `0x${string}` {
    // Use manual ABI since deployedContracts.ts may not be regenerated yet
    const authorizeAbi = [
      {
        type: "function",
        name: "authorize",
        inputs: [
          {
            name: "paymentInfo",
            type: "tuple",
            components: [
              { name: "operator", type: "address" },
              { name: "payer", type: "address" },
              { name: "receiver", type: "address" },
              { name: "token", type: "address" },
              { name: "maxAmount", type: "uint120" },
              { name: "preApprovalExpiry", type: "uint48" },
              { name: "authorizationExpiry", type: "uint48" },
              { name: "refundExpiry", type: "uint48" },
              { name: "minFeeBps", type: "uint16" },
              { name: "maxFeeBps", type: "uint16" },
              { name: "feeReceiver", type: "address" },
              { name: "salt", type: "uint256" },
            ],
          },
          {
            name: "collectorData",
            type: "bytes",
          },
        ],
        outputs: [],
        stateMutability: "nonpayable",
      },
    ] as const;

    return encodeFunctionData({
      abi: authorizeAbi,
      functionName: "authorize",
      args: [
        {
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
        },
        collectorData,
      ],
    });
  }

  async uploadCampaignMetadata(formData: CampaignUploadFormData): Promise<string> {
    // Compose metadata JSON
    const metadata = {
      denomination: {
        unit: formData.denominationUnit,
        amount: formData.denominationAmount,
      },
    };

    // Upload metadata JSON
    const metadataResult = await this.storageGateway.storeJson(metadata, {
      contentType: "application/json",
    });

    return metadataResult.uri;
  }
}

export default CampaignProvider;
