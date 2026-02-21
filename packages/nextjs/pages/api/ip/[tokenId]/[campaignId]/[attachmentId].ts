import "reflect-metadata";
import {
  createHandler,
  Get,
  Post,
  Query,
  ParseNumberPipe,
  Res,
  Header,
  Req,
  Body,
  ValidationPipe,
} from "next-api-decorators";
import * as Next from "next";
import AttachmentProvider from "~~/services/provider/attachment";
import { handleAttachmentError } from "~~/utils/scaffold-eth/apiUtils";
import { buildSiweChallengeResponse, parseAndVerifySiweAuth } from "~~/utils/auth/siwe";
import { getExpectedDomain } from "~~/utils/scaffold-eth/apiUtils";
import { decryptSessionToken } from "~~/utils/auth/sessionToken";
import { IncomingMessage } from "http";
import { Attachment, DecryptAuth } from "~~/types/liquidip";
import { AttachmentRequestDTO } from "~~/utils/dto/quote";
import { computePaymentInfoHash } from "~~/utils/auth";
import { createIndexerGateway } from "~~/services/gateway/indexer/IndexerGatewayFactory";
import { IIndexerGateway } from "~~/services/gateway/indexer/indexer";
import { createCaptureService, type ICaptureService } from "~~/services/capture";
import type { PaymentInfoDto } from "~~/types/liquidip";

// this api should return for specific attachment for specific ip in form of raw bytes requiring x402 payment in campaignId token

class IpAttachmentHandler {
  private attachmentProvider: AttachmentProvider;
  private indexerGateway: IIndexerGateway;
  private captureService: ICaptureService;

  constructor() {
    this.attachmentProvider = new AttachmentProvider();
    this.indexerGateway = createIndexerGateway();
    this.captureService = createCaptureService();
  }

  @Get()
  async getAttachmentQuote(
    @Query("tokenId", ParseNumberPipe()) tokenId: number,
    @Query("campaignId") campaignId: string,
    @Query("attachmentId", ParseNumberPipe()) attachmentId: number,
    @Res() res: Next.NextApiResponse,
  ) {
    const metadata = await this.attachmentProvider.getAttachmentMetadata(tokenId, attachmentId).catch(error => {
      console.error("Error getting attachment metadata:", error);
      throw error;
    });

    const campaign = await this.indexerGateway.getCampaignDetails(tokenId, campaignId);

    if (!campaign) {
      return res.status(404).json({
        error: "Campaign not found",
        details: "The campaign associated with the IP and attachment does not exist.",
      });
    }

    if (campaign.denomination.unit !== "PER_BYTE") {
      return res.status(400).json({
        error: "Invalid denomination unit",
        details: "The campaign denomination unit must be PER_BYTE to get attachment quote.",
      });
    }

    const amount = campaign.denomination.amount * metadata.fileSizeBytes;
    return res.status(200).json({ amount });
  }

  @Post()
  async getIpAttachment(
    @Query("tokenId", ParseNumberPipe()) tokenId: number,
    @Query("campaignId") campaignId: string, // Not used for now
    @Query("attachmentId", ParseNumberPipe()) attachmentId: number,
    @Body(ValidationPipe()) body: AttachmentRequestDTO,
    @Res() res: Next.NextApiResponse,
    @Req() req: IncomingMessage,
    @Header("Authorization") authorization?: string,
  ) {
    const accountAddress = body?.address;

    // If the attachment is plain, return the data directly
    const metadata: Attachment = await this.attachmentProvider
      .getAttachmentMetadata(tokenId, attachmentId)
      .catch(error => {
        console.error("Error getting attachment metadata:", error);
        throw error;
      });

    if (metadata?.type === "PLAIN") {
      const attachmentResult = await this.attachmentProvider.getAttachment(metadata.uri);

      res.setHeader("Content-Type", attachmentResult.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="attachment-${attachmentId}"`);
      res.end(attachmentResult.data);
      return;
    }

    const campaign = await this.indexerGateway.getCampaignDetails(tokenId, campaignId);
    const ipDetails = await this.indexerGateway.getIpDetails(tokenId);

    if (!campaign) {
      return res.status(404).json({
        error: "Campaign not found",
        details: "The campaign associated with the IP and attachment does not exist.",
      });
    }

    if (campaign.denomination.unit !== "PER_BYTE") {
      return res.status(400).json({
        error: "Invalid denomination unit",
        details: "For private attachments, the denomination unit of the campaign token to pay with must be PER_BYTE.",
      });
    }

    // Non-plain attachment requires payment info
    const hasPaymentInfo = body?.paymentInfo != null;
    if (!hasPaymentInfo) {
      return res.status(400).json({
        error: "Payment info required",
        details: "Private attachments require payment info in the request body (e.g. from prepareAuthorize).",
      });
    }

    if (!accountAddress) {
      return res.status(401).json({
        error:
          "Private patent data is protected by Sign with Ethereum authentication. Provide your account address in the request body for proper SIWE message to be generated.",
      });
    }

    // ── No Authorization header → return 401 SIWE challenge ──────────
    if (!authorization) {
      try {
        const resourceId = await this.attachmentProvider.getDecryptResourceId(metadata);

        const siweChallengeResponse = await buildSiweChallengeResponse(req, accountAddress, resourceId);

        res.status(401).json(siweChallengeResponse);
        return;
      } catch (error) {
        return handleAttachmentError(error, res);
      }
    }

    // ── Has Authorization header → verify SIWE and decrypt ───────────
    try {
      const domain = getExpectedDomain(req);
      const { authSig, opaqueToken } = await parseAndVerifySiweAuth(authorization, domain, accountAddress);

      // Recover the session key pair from the opaque token
      const sessionKeyPair = decryptSessionToken(opaqueToken);

      const decryptAuth: DecryptAuth = { authSig, sessionKeyPair, domain };

      const paymentInfoHash = await computePaymentInfoHash(body.paymentInfo || {});
      const requiredAuthorizedAmount = campaign.denomination.amount * metadata.fileSizeBytes;

      const attachmentResult = await this.attachmentProvider.getAttachment(
        metadata.uri,
        requiredAuthorizedAmount,
        paymentInfoHash,
        decryptAuth,
      );

      const pkpAddress = ipDetails?.owner;
      const captureId = `${tokenId}-${Date.now()}`;

      // TODO: Uncomment this when naga-test is working
      // this.captureService
      //   .capture({
      //     pkpAddress: pkpAddress!,
      //     paymentInfo: body.paymentInfo as PaymentInfoDto,
      //     amount: BigInt(requiredAuthorizedAmount),
      //   })
      //   .then(result => {
      //     if (!result.success) {
      //       console.error(`[Capture] ${captureId} FAILED - NEEDS MANUAL REVIEW: ${result.error}`);
      //     }
      //   })
      //   .catch(err => {
      //     console.error(`[Capture] ${captureId} EXCEPTION - NEEDS MANUAL REVIEW:`, err);
      //   });

      res.setHeader("Content-Type", attachmentResult.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="attachment-${attachmentId}"`);
      res.end(attachmentResult.data);
      return;
    } catch (error) {
      return handleAttachmentError(error, res);
    }
  }
}

export default createHandler(IpAttachmentHandler);
