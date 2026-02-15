import "reflect-metadata";
import { createHandler, Get, Query, ParseNumberPipe, Res, Header, Req } from "next-api-decorators";
import * as Next from "next";
import { generateSessionKeyPair } from "@lit-protocol/auth";
import { SIWE_URI_PREFIX } from "@lit-protocol/constants";
import AttachmentProvider from "~~/services/provider/attachment";
import { handleAttachmentError } from "~~/utils/scaffold-eth/apiUtils";
import { UnauthorizedError } from "~~/utils/scaffold-eth/errors";
import { buildSiweChallengeResponse, buildSiweMessage, parseAndVerifySiweAuth } from "~~/utils/auth/siwe";
import { getExpectedDomain } from "~~/utils/scaffold-eth/apiUtils";
import { encryptSessionToken, decryptSessionToken } from "~~/utils/auth/sessionToken";
import { getLitClient } from "~~/utils/lit/client";
import scaffoldConfig from "~~/scaffold.config";
import { IncomingMessage } from "http";
import type { AuthSig } from "@lit-protocol/types";
import type { SessionKeyPair } from "~~/utils/lit/client";
import { Attachment, DecryptAuth } from "~~/types/liquidip";

// this api should return for specific attachment for specific ip in form of raw bytes requiring x402 payment in campaignId token

class IpAttachmentHandler {
  private attachmentProvider: AttachmentProvider;

  constructor() {
    this.attachmentProvider = new AttachmentProvider();
  }

  @Get()
  async getIpAttachment(
    @Query("tokenId", ParseNumberPipe()) tokenId: number,
    @Query("campaignId") campaignId: string, // Not used for now
    @Query("attachmentId", ParseNumberPipe()) attachmentId: number,
    @Res() res: Next.NextApiResponse,
    @Req() req: IncomingMessage,
    @Query("accountAddress") accountAddress?: string,
    @Header("Authorization") authorization?: string,
  ) {
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

    if (!accountAddress) {
      return res.status(401).json({
        error:
          "Private patent data is protected by Sign with Ethereum authentication. Provide your account address for proper SIWE message to be generated.",
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

      const attachmentResult = await this.attachmentProvider.getAttachment(metadata.uri, decryptAuth);

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
