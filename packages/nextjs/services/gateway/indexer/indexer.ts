/**
 * Abstract indexer gateway interface that supports multiple indexer backends
 * (The Graph, Ponder, custom indexers, etc.)
 */
import type { Campaign, IPDetails, IPList } from "~~/types/liquidip";

/**
 * Abstract indexer gateway interface
 *
 * Implementations should provide concrete indexer backends:
 * - GraphIndexerGateway (for The Graph)
 * - PonderIndexerGateway (for Ponder)
 * - CustomIndexerGateway (for custom indexers)
 * - etc.
 */
export interface IIndexerGateway {
  /**
   * Get list of IPs from the indexer
   *
   * @returns Promise resolving to an array of IPs
   */
  getIpList(page: number, pageSize: number): Promise<IPList>;

  /**
   * Get IP details by token ID from the indexer
   *
   * @param tokenId - The token ID of the IP to retrieve
   * @returns Promise resolving to IP details
   */
  getIpDetails(tokenId: number): Promise<IPDetails>;

  /**
   * Get campaign details by token ID and license address
   *
   * @param tokenId - The token ID of the IP
   * @param licenseAddress - The license (campaign) contract address
   * @returns Promise resolving to campaign details, or null if not found
   */
  getCampaignDetails(tokenId: number, licenseAddress: string): Promise<Campaign | null>;
}
