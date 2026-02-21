// this file should contain an abstract implementation of service to fetch and return data for ip entities, should call gateways to fetch data
// represents layer 2, should not be aware of layer 1 services (gateways) and be able to work with any implementation of them
// should implement pagination and caching mechanisms
import { readFileSync } from "fs";
import { createIndexerGateway } from "~~/services/gateway/indexer/IndexerGatewayFactory";
import { IIndexerGateway } from "~~/services/gateway/indexer/indexer";
import { createStorageGateway } from "~~/services/gateway/storage/StorageGatewayFactory";
import { IStorageGateway } from "~~/services/gateway/storage/storage";
import { Attachment, IPDetails, IPList } from "~~/types/liquidip";
import { UploadFormData } from "~~/types/liquidip";

class IpProvider {
  private indexerGateway: IIndexerGateway;
  private storageGateway: IStorageGateway;

  constructor() {
    this.indexerGateway = createIndexerGateway();
    this.storageGateway = createStorageGateway();
  }

  async getIpList(page: number, pageSize: number): Promise<IPList> {
    return await this.indexerGateway.getIpList(page, pageSize);
  }

  async getIpDetails(tokenId: number): Promise<IPDetails> {
    return await this.indexerGateway.getIpDetails(tokenId);
  }

  async uploadIpMetadata(formData: UploadFormData): Promise<string> {
    // Upload image file
    const imageBuffer = readFileSync(formData.image.filepath);
    const imageResult = await this.storageGateway.store(imageBuffer, {
      contentType: formData.image.mimetype || "image/jpeg",
    });

    // Upload attachment files
    const attachmentUploads = await Promise.all(
      formData.attachments.map(async (attachment: any) => {
        const fileBuffer = readFileSync(attachment.file.filepath);
        const fileResult = await this.storageGateway.store(fileBuffer, {
          contentType: attachment.file.mimetype || "application/octet-stream",
        });

        return {
          name: attachment.name,
          type: attachment.type,
          description: attachment.description,
          fileType: attachment.file.mimetype || "application/octet-stream",
          fileSizeBytes: attachment.file.size,
          uri: fileResult.uri,
        } as Attachment;
      }),
    );

    // Compose metadata JSON
    const metadata = {
      tokenId: 0,
      name: formData.name,
      description: formData.description,
      image: imageResult.uri,
      externalUrl: formData.externalUrl || "",
      attachments: attachmentUploads,
    };

    // Upload metadata JSON
    const metadataResult = await this.storageGateway.storeJson(metadata, {
      contentType: "application/json",
    });

    return metadataResult.uri;
  }
}

export default IpProvider;
