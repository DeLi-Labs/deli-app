import "reflect-metadata";
import { createHandler, Post, Req } from "next-api-decorators";
import { IncomingMessage } from "http";
import CampaignProvider from "../../../services/provider/campaign";
import { parseCampaignFormData } from "~~/utils/scaffold-eth/apiUtils";

// Disable body parsing for form data
export const config = {
  api: {
    bodyParser: false,
  },
};

class CampaignHandler {
  private campaignProvider: CampaignProvider;

  constructor() {
    this.campaignProvider = new CampaignProvider();
  }

  @Post()
  async uploadCampaignMetadata(@Req() req: IncomingMessage) {
    const parseResult = await parseCampaignFormData(req);

    if (!parseResult.success) {
      return { error: parseResult.error };
    }

    try {
      const metadataUri = await this.campaignProvider.uploadCampaignMetadata(parseResult.data);
      return { uri: metadataUri };
    } catch (error) {
      console.error("Error uploading campaign metadata:", error);
      return {
        error: error instanceof Error ? error.message : "Failed to upload campaign metadata",
      };
    }
  }
}

export default createHandler(CampaignHandler);
