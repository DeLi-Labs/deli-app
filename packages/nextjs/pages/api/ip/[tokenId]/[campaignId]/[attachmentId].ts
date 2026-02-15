import "reflect-metadata";
import { createHandler, Get, Query, ParseNumberPipe, Res, Header, Req } from "next-api-decorators";
import * as Next from "next";
import { generateSessionKeyPair } from "@lit-protocol/auth";
import { SIWE_URI_PREFIX } from "@lit-protocol/constants";
import AttachmentProvider from "~~/services/provider/attachment";
import { handleAttachmentError } from "~~/utils/scaffold-eth/apiUtils";
import { UnauthorizedError } from "~~/utils/scaffold-eth/errors";
import { buildSiweMessage, parseAndVerifySiweAuth } from "~~/utils/auth/siwe";
import { getExpectedDomain } from "~~/utils/scaffold-eth/apiUtils";
import { encryptSessionToken, decryptSessionToken } from "~~/utils/auth/sessionToken";
import { getLitClient } from "~~/utils/lit/client";
import scaffoldConfig from "~~/scaffold.config";
import { IncomingMessage } from "http";
import type { AuthSig } from "@lit-protocol/types";
import type { SessionKeyPair } from "~~/utils/lit/client";

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
    if (!accountAddress) {
      throw new UnauthorizedError(
        "Endpoint is protected by Sign with Ethereum authentication. Provide your account address for proper SIWE message to be generated.",
      );
    }

    // ── No Authorization header → return 401 SIWE challenge ──────────
    if (!authorization) {
      try {
        const domain = getExpectedDomain(req);

        let resourceId: string | undefined;
        const metadata = await this.attachmentProvider.getAttachmentMetadata(tokenId, attachmentId).catch(() => null);

        if (metadata?.type === "ENCRYPTED") {
          resourceId = await this.attachmentProvider.getDecryptResourceId(tokenId, attachmentId);
        }

        // Generate a fresh session key pair and fetch the Lit blockhash nonce
        const sessionKeyPair = generateSessionKeyPair();
        const litClient = await getLitClient();
        const { latestBlockhash } = await litClient.getContext();
        const sessionKeyUri = `${SIWE_URI_PREFIX.SESSION_KEY}${sessionKeyPair.publicKey}`;

        const message = await buildSiweMessage({
          domain,
          sessionKeyUri,
          nonce: latestBlockhash,
          address: accountAddress,
          chainId: scaffoldConfig.targetNetworks[0]?.id ?? 1,
          resourceId,
        });

        // Encrypt the session key pair into an opaque token (stateless)
        const opaqueToken = encryptSessionToken(sessionKeyPair);

        res.status(401).json({
          error: "Signature required",
          message,
          opaqueToken,
          siwe: { domain, resourceId, chainId: scaffoldConfig.targetNetworks[0]?.id ?? 1 },
        });
        return;
      } catch (error) {
        return handleAttachmentError(error, res);
      }
    }

    // ── Has Authorization header → verify SIWE and decrypt ───────────
    try {
      const attachmentMetadata = await this.attachmentProvider.getAttachmentMetadata(tokenId, attachmentId);

      let decryptAuth: { authSig: AuthSig; sessionKeyPair: SessionKeyPair; domain: string } | undefined;

      if (attachmentMetadata.type === "ENCRYPTED") {
        const domain = getExpectedDomain(req);
        const { authSig, opaqueToken } = await parseAndVerifySiweAuth(authorization, domain, accountAddress);

        // Recover the session key pair from the opaque token
        const sessionKeyPair = decryptSessionToken(opaqueToken);

        decryptAuth = { authSig, sessionKeyPair, domain };
      }

      const attachmentResult = await this.attachmentProvider.getAttachment(attachmentMetadata.uri, decryptAuth);

      res.setHeader("Content-Type", attachmentResult.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="attachment-${attachmentId}"`);
      res.send(attachmentResult.data);
      return;
    } catch (error) {
      return handleAttachmentError(error, res);
    }
  }
}

export default createHandler(IpAttachmentHandler);
