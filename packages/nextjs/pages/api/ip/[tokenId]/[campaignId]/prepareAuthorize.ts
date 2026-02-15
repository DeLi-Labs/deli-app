import "reflect-metadata";
import * as Next from "next";
import { createHandler, Post, Body, ParseNumberPipe, Res, ValidationPipe, Query } from "next-api-decorators";
import { parseUnits, type Address } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import externalContracts from "~~/contracts/externalContracts";
import scaffoldConfig from "~~/scaffold.config";
import CampaignProvider from "~~/services/provider/campaign";
import type { PaymentInfoDto, PermitTransferFromMessage, PrepareAuthorizeResponse } from "~~/types/liquidip";
import { Permit2RequestDTO } from "~~/utils/dto/quote";
import { validatePermitTransferFromMessage } from "~~/utils/auth/permit";

const LICENSE_DECIMALS = 18;

class PrepareAuthorizeHandler {
  private campaignProvider = new CampaignProvider();
  private readonly chainId: number;
  private readonly campaignManagerAddress: string;
  private readonly permit2Address: Address;

  constructor() {
    this.chainId = scaffoldConfig.targetNetworks[0].id;
    const chainContracts = (deployedContracts as Record<number, Record<string, { address: string }>>)[this.chainId];
    const campaignManagerAddress = chainContracts?.CampaignManager?.address;
    if (!campaignManagerAddress) {
      throw new Error(`CampaignManager not deployed on chain ${this.chainId}`);
    }
    this.campaignManagerAddress = campaignManagerAddress;

    // Get Permit2 address from external contracts
    const externalChainContracts = (externalContracts as Record<number, Record<string, { address: string }>>)[
      this.chainId
    ];
    const permit2Contract = externalChainContracts?.Permit2;
    if (!permit2Contract) {
      throw new Error(`Permit2 not configured for chain ${this.chainId}`);
    }
    this.permit2Address = permit2Contract.address as Address;
  }

  @Post()
  async prepareAuthorize(
    @Query("tokenId", ParseNumberPipe()) tokenId: number,
    @Query("campaignId") campaignId: string,
    @Body(ValidationPipe()) body: Permit2RequestDTO,
    @Res() res: Next.NextApiResponse,
  ): Promise<PrepareAuthorizeResponse | void> {
    try {
      const campaign = await this.campaignProvider.getCampaignDetails(tokenId, campaignId);
      if (!campaign) {
        res.status(404).json({ error: "Campaign not found" });
        return;
      }

      const amountRaw = parseUnits(body.amount.toString(), LICENSE_DECIMALS);
      const userAddr = body.userAddress as Address;
      const licenseAddr = campaign.licenseAddress as Address;
      const campaignManagerAddr = this.campaignManagerAddress as Address;

      // Get Permit2PaymentCollector address from CampaignManager
      const permit2TokenCollectorAddr =
        await this.campaignProvider.getPermit2TokenCollectorAddress(campaignManagerAddr);

      // If no permit provided, build PaymentInfo and return PermitTransferFrom message for signing
      if (!body.permit) {
        const paymentInfo = await this.campaignProvider.buildPaymentInfo(userAddr, licenseAddr, amountRaw);

        const permitMessage = await this.campaignProvider.createPermitTransferFromMessage(
          paymentInfo,
          permit2TokenCollectorAddr,
        );

        const response: PrepareAuthorizeResponse = {
          amount: body.amount,
          requiresSignature: true,
          permitMessage,
          paymentInfo,
          instructions:
            "Sign the permitMessage using EIP-712 (signTypedData) and provide the signature along with the permit message and paymentInfo in the next request to get the executable transaction.",
        };

        return response;
      }

      // Permit provided - validate and create transaction
      const { permit } = body;
      const permitMsg = permit.message as unknown as PermitTransferFromMessage;
      const paymentInfo = body.paymentInfo as unknown as PaymentInfoDto;

      if (!paymentInfo) {
        res.status(400).json({
          error: "Missing paymentInfo",
          details: "paymentInfo must be provided along with the permit when requesting a transaction.",
        });
        return;
      }

      // Validate permit message using PermitTransferFrom validation
      const validationResult = await validatePermitTransferFromMessage(permitMsg, permit.signature, {
        chainId: this.chainId,
        permit2Address: this.permit2Address,
        tokenAddress: licenseAddr,
        spenderAddress: permit2TokenCollectorAddr,
        userAddress: userAddr,
        amountRaw,
      });

      if (!validationResult.valid) {
        res.status(400).json({
          error: validationResult.error,
          details: validationResult.details,
        });
        return;
      }

      // All validations passed - create transaction payload
      // collectorData is the signature for Permit2PaymentCollector
      const collectorData = permit.signature as `0x${string}`;
      const data = this.campaignProvider.encodeAuthorizeWithPermit(paymentInfo, collectorData);

      const response: PrepareAuthorizeResponse = {
        amount: body.amount,
        requiresSignature: false,
        txData: {
          chainId: this.chainId,
          payload: {
            to: this.campaignManagerAddress as `0x${string}`,
            data,
            value: "0x0" as `0x${string}`,
          },
        },
      };

      return response;
    } catch (error) {
      res.status(500).json({
        error: "Failed to process prepareAuthorize request",
        details: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }
}

export default createHandler(PrepareAuthorizeHandler);
