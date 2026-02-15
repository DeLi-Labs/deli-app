// this file should contain an abstract implementation of service to fetch and return attachment data for ip entities
// should call gateways to fetch data and decrypt if needed
// represents layer 2, should not be aware of layer 1 services (gateways) and be able to work with any implementation of them
import type { AuthSig } from "@lit-protocol/types";
import { createCipherGateway } from "~~/services/gateway/cipher/CipherGatewayFactory";
import { EncryptedData, ICipherGateway } from "~~/services/gateway/cipher/cipher";
import { DEFAULT_ACCESS_CONTROL_CONDITIONS } from "~~/services/gateway/cipher/impl/LocalCipherGateway";
import { createIndexerGateway } from "~~/services/gateway/indexer/IndexerGatewayFactory";
import { IIndexerGateway } from "~~/services/gateway/indexer/indexer";
import { createStorageGateway } from "~~/services/gateway/storage/StorageGatewayFactory";
import { IStorageGateway } from "~~/services/gateway/storage/storage";
import { Attachment } from "~~/types/liquidip";
import { computeDecryptResourceId } from "~~/utils/auth";
import type { SessionKeyPair } from "~~/utils/lit/client";
import { NotFoundError } from "~~/utils/scaffold-eth/errors";

type AttachmentResult = {
  data: Buffer | Uint8Array;
  contentType: string;
};

class AttachmentProvider {
  private indexerGateway: IIndexerGateway;
  private storageGateway: IStorageGateway;
  private cipherGateway: ICipherGateway;

  constructor() {
    this.indexerGateway = createIndexerGateway();
    this.storageGateway = createStorageGateway();
    this.cipherGateway = createCipherGateway();
  }

  async getAttachmentMetadata(tokenId: number, attachmentId: number): Promise<Attachment> {
    // 1. Fetch IP details from indexer gateway
    const ipDetails = await this.indexerGateway.getIpDetails(tokenId);

    // 2. Find attachment from fetched attachment array with index provided
    if (!ipDetails.attachments || attachmentId < 0 || attachmentId >= ipDetails.attachments.length) {
      throw new NotFoundError(`Attachment with index ${attachmentId} not found for tokenId ${tokenId}`);
    }

    return ipDetails.attachments[attachmentId];
  }

  /**
   * Compute the Lit decrypt resource id for an encrypted attachment.
   * Used when returning a 401 SIWE challenge so the client can include the ReCap in the signed message.
   */
  async getDecryptResourceId(tokenId: number, attachmentId: number): Promise<string> {
    const attachment = await this.getAttachmentMetadata(tokenId, attachmentId);
    const retrieveResult = await this.storageGateway.retrieve(attachment.uri);
    const encryptedData = EncryptedData.fromSerialized(retrieveResult.data);
    return computeDecryptResourceId(DEFAULT_ACCESS_CONTROL_CONDITIONS, encryptedData.getHash());
  }

  async getAttachment(
    uri: string,
    decryptAuth?: { authSig: AuthSig; sessionKeyPair: SessionKeyPair; domain?: string },
  ): Promise<AttachmentResult> {
    const retrieveResult = await this.storageGateway.retrieve(uri);

    console.log("retrieveResult", retrieveResult.contentType);
    console.log("retrieveResult", retrieveResult.metadata);

    if (!decryptAuth) {
      return {
        data: retrieveResult.data instanceof Buffer ? retrieveResult.data : Buffer.from(retrieveResult.data),
        contentType: retrieveResult.contentType || "application/octet-stream",
      };
    }

    const encryptedData = EncryptedData.fromSerialized(retrieveResult.data);

    console.log("encryptedData", encryptedData.getMetadata());

    const decryptedData = await this.cipherGateway.decrypt(encryptedData, {
      auth: {
        authSig: decryptAuth.authSig,
        sessionKeyPair: decryptAuth.sessionKeyPair,
      },
      domain: decryptAuth.domain,
    });

    return {
      data: decryptedData.decryptedData,
      contentType: retrieveResult.contentType || "application/octet-stream",
    };
  }
}

export default AttachmentProvider;
