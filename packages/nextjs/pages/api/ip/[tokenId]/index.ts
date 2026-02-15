import "reflect-metadata";
import { createHandler, Get, Query, ParseNumberPipe } from "next-api-decorators";
import IpProvider from "../../../../services/provider/ip";

class IpDetailsHandler {
  private ipProvider: IpProvider;

  constructor() {
    this.ipProvider = new IpProvider();
  }

  @Get()
  async getIpDetails(@Query("tokenId", ParseNumberPipe()) tokenId: number) {
    const ip = await this.ipProvider.getIpDetails(tokenId);
    return ip;
  }
}

export default createHandler(IpDetailsHandler);
