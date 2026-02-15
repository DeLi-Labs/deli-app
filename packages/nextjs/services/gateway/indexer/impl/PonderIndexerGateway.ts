import { IIndexerGateway } from "../indexer";
import { GraphQLClient } from "graphql-request";
import { getSdk } from "~~/generated/graphql";
import { Attachment, Campaign, IPDetails, IPList } from "~~/types/liquidip";

export class PonderIndexerGateway implements IIndexerGateway {
  private client: ReturnType<typeof getSdk>;

  constructor() {
    const ponderUrl = process.env.NEXT_PUBLIC_PONDER_URL || "http://localhost:42069/graphql";
    const graphQLClient = new GraphQLClient(ponderUrl);
    this.client = getSdk(graphQLClient);
  }

  async getIpList(page: number, pageSize: number): Promise<IPList> {
    try {
      const offset = page * pageSize;
      const result = await this.client.Ips({
        limit: pageSize,
        offset: offset,
        orderBy: "tokenId",
        orderDirection: "asc",
      });

      return result.ips.items.map(ip => this.mapIpToIP(ip));
    } catch (error) {
      console.error("Error fetching IP list from Ponder:", error);
      throw new Error(`Failed to fetch IP list: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getIpDetails(tokenId: number): Promise<IPDetails> {
    try {
      // Query by tokenId filter - BigInt in GraphQL is represented as a string
      const result = await this.client.Ips({
        where: {
          tokenId: tokenId.toString(),
        },
        limit: 1,
      });

      if (!result.ips.items || result.ips.items.length === 0) {
        throw new Error(`IP with tokenId ${tokenId} not found`);
      }

      const ip = result.ips.items[0];
      return this.mapIpToIPDetails(ip);
    } catch (error) {
      console.error(`Error fetching IP details for tokenId ${tokenId} from Ponder:`, error);
      throw new Error(`Failed to fetch IP details: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getCampaignDetails(tokenId: number, licenseAddress: string): Promise<Campaign | null> {
    try {
      const result = await this.client.Campaigns({
        where: {
          licenseAddress: licenseAddress.toLowerCase(),
        },
        limit: 100, // Reasonable limit to find matching campaign
      });

      if (!result.campaigns.items || result.campaigns.items.length === 0) {
        return null;
      }

      // Find the campaign where the related IP's tokenId matches
      const campaign = result.campaigns.items.find(c => c.ip && Number(c.ip.tokenId) === tokenId);

      if (!campaign) {
        return null;
      }

      return {
        licenseAddress: campaign.licenseAddress,
        numeraireAddress: campaign.numeraireAddress,
        poolId: campaign.poolId,
        denomination: {
          unit: campaign.denominationUnit as Campaign["denomination"]["unit"],
          amount: Number(campaign.denominationAmount),
        },
      };
    } catch (error) {
      console.error(`Error fetching campaign for tokenId ${tokenId}, license ${licenseAddress}:`, error);
      return null;
    }
  }

  /**
   * Maps Ponder IP to IP type (for list view)
   */
  private mapIpToIP(ip: {
    tokenId: string;
    name: string;
    description: string;
    campaigns?: {
      items: Array<{
        licenseAddress: string;
        numeraireAddress: string;
        poolId: string;
        denominationUnit: string;
        denominationAmount: string;
      }>;
    } | null;
  }): { tokenId: number; name: string; description: string; campaigns: Campaign[] } {
    return {
      tokenId: Number(ip.tokenId),
      name: ip.name,
      description: ip.description,
      campaigns:
        ip.campaigns?.items.map(campaign => ({
          licenseAddress: campaign.licenseAddress,
          numeraireAddress: campaign.numeraireAddress,
          poolId: campaign.poolId,
          denomination: {
            unit: campaign.denominationUnit as Campaign["denomination"]["unit"],
            amount: Number(campaign.denominationAmount),
          },
        })) || [],
    };
  }

  /**
   * Maps Ponder IP to IPDetails type (for detail view)
   */
  private mapIpToIPDetails(ip: {
    tokenId: string;
    name: string;
    description: string;
    image: string;
    externalUrl: string;
    attachments?: {
      items: Array<{
        name: string;
        type: string;
        description: string;
        fileType: string;
        fileSizeBytes: string;
        uri: string;
      }>;
    } | null;
  }): IPDetails {
    return {
      tokenId: Number(ip.tokenId),
      name: ip.name,
      description: ip.description,
      image: ip.image,
      externalUrl: ip.externalUrl,
      attachments:
        ip.attachments?.items.map(att => ({
          name: att.name,
          type: att.type as Attachment["type"],
          description: att.description,
          fileType: att.fileType,
          fileSizeBytes: Number(att.fileSizeBytes),
          uri: att.uri,
        })) || [],
    };
  }
}
