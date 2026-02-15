import "reflect-metadata";
import * as Next from "next";
import { createHandler, Post, Body, ParseNumberPipe, Res, ValidationPipe, Query } from "next-api-decorators";
import { formatUnits, parseUnits, type Address } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import externalContracts from "~~/contracts/externalContracts";
import scaffoldConfig from "~~/scaffold.config";
import CampaignProvider from "~~/services/provider/campaign";
import type { PermitMessage, QuoteResponse, PermitSingle } from "~~/types/liquidip";
import { QuoteRequestDTO } from "~~/utils/dto/quote";
import { validatePermitMessage } from "~~/utils/auth/permit";

const LICENSE_DECIMALS = 18;

class QuoteHandler {
  private campaignProvider = new CampaignProvider();
  private readonly chainId: number;
  private readonly routerAddress: string;
  private readonly permit2Address: Address;

  constructor() {
    this.chainId = scaffoldConfig.targetNetworks[0].id;
    const chainContracts = (deployedContracts as Record<number, Record<string, { address: string }>>)[this.chainId];
    const routerAddress = chainContracts?.FixedPriceSwapRouter?.address;
    if (!routerAddress) {
      throw new Error(`FixedPriceSwapRouter not deployed on chain ${this.chainId}`);
    }
    this.routerAddress = routerAddress;

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
  async quote(
    @Query("tokenId", ParseNumberPipe()) tokenId: number,
    @Query("campaignId") campaignId: string,
    @Body(ValidationPipe()) body: QuoteRequestDTO,
    @Res() res: Next.NextApiResponse,
  ): Promise<QuoteResponse | void> {
    try {
      const campaign = await this.campaignProvider.getCampaignDetails(tokenId, campaignId);
      if (!campaign) {
        res.status(404).json({ error: "Campaign not found" });
        return;
      }

      const amountOutRaw = parseUnits(body.amount.toString(), LICENSE_DECIMALS);
      const amountInRaw = await this.campaignProvider.getQuoteExactOutput(campaign, amountOutRaw);

      const userAddr = body.userAddress as Address;
      const tokenAddr = campaign.numeraireAddress as Address;
      const routerAddr = this.routerAddress as Address;

      // If no permit provided, return permit message for signing
      if (!body.permit) {
        const permitMessage = await this.campaignProvider.createPermitMessage(
          userAddr,
          tokenAddr,
          amountInRaw,
          routerAddr,
          BigInt(Math.floor(Date.now() / 1000) + 30 * 60), // 30 minutes deadline
        );

        const response: QuoteResponse = {
          amountIn: parseFloat(formatUnits(amountInRaw, LICENSE_DECIMALS)),
          amountOut: body.amount,
          requiresSignature: true,
          permitMessage,
          instructions:
            "Sign the permitMessage using EIP-712 (signTypedData) and provide the signature along with the permit message in the next request to get the executable transaction.",
        };

        return response;
      }

      // Permit provided - validate and create transaction
      const { permit } = body;
      const permitMsg = permit.message as PermitMessage;

      // Validate permit message using utility function
      const validationResult = await validatePermitMessage(permitMsg, permit.signature, {
        chainId: this.chainId,
        permit2Address: this.permit2Address,
        tokenAddress: tokenAddr,
        routerAddress: routerAddr,
        userAddress: userAddr,
        amountInRaw,
      });

      if (!validationResult.valid) {
        res.status(400).json({
          error: validationResult.error,
          details: validationResult.details,
        });
        return;
      }

      // All validations passed - create transaction payload
      const permitAmount = BigInt(permitMsg.message.details.amount);
      const permitSingle: PermitSingle = {
        details: {
          token: permitMsg.message.details.token as Address,
          amount: permitAmount,
          expiration: BigInt(permitMsg.message.details.expiration),
          nonce: BigInt(permitMsg.message.details.nonce),
        },
        spender: permitMsg.message.spender as Address,
        sigDeadline: BigInt(permitMsg.message.sigDeadline),
      };

      const data = this.campaignProvider.encodeSwapExactOutputSingle(
        campaign,
        amountOutRaw,
        amountInRaw,
        permitSingle,
        permit.signature as `0x${string}`,
      );

      const response: QuoteResponse = {
        amountIn: parseFloat(formatUnits(amountInRaw, LICENSE_DECIMALS)),
        amountOut: body.amount,
        requiresSignature: false,
        txData: {
          chainId: this.chainId,
          payload: {
            to: this.routerAddress as `0x${string}`,
            data,
            value: "0x0" as `0x${string}`,
          },
        },
      };

      return response;
    } catch (error) {
      res.status(500).json({
        error: "Failed to process quote request",
        details: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }
}

export default createHandler(QuoteHandler);
