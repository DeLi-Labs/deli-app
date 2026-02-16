import "reflect-metadata";
import { createHandler, Get, Post, Query, ParseNumberPipe, DefaultValuePipe, Req } from "next-api-decorators";
import { IncomingMessage } from "http";
import IpProvider from "../../../services/provider/ip";
import { parseFormData } from "~~/utils/scaffold-eth/apiUtils";

// Disable body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

class IpHandler {
  private ipProvider: IpProvider;

  constructor() {
    this.ipProvider = new IpProvider();
  }

  @Get()
  async getIpList(
    @Query("page", DefaultValuePipe(0), ParseNumberPipe()) page: number,
    @Query("pageSize", DefaultValuePipe(10), ParseNumberPipe()) pageSize: number,
  ) {
    const ipList = await this.ipProvider.getIpList(page, pageSize);
    return ipList;
  }

  // TODO: implmenta validation of lit authentication token
  @Post()
  async uploadIpMetadata(@Req() req: IncomingMessage) {
    const parseResult = await parseFormData(req);

    if (!parseResult.success) {
      return { error: parseResult.error };
    }

    try {
      const metadataUri = await this.ipProvider.uploadIpMetadata(parseResult.data);
      return { uri: metadataUri };
    } catch (error) {
      console.error("Error uploading IP metadata:", error);
      return {
        error: error instanceof Error ? error.message : "Failed to upload IP metadata",
      };
    }
  }
}

export default createHandler(IpHandler);
