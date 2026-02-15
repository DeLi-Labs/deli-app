import { PonderIndexerGateway } from "./impl/PonderIndexerGateway";
import { IIndexerGateway } from "./indexer";

export const enum IndexerGatewayType {
  THE_GRAPH = "THE_GRAPH",
  PONDER = "PONDER",
}

const registry: Record<IndexerGatewayType, () => IIndexerGateway> = {
  [IndexerGatewayType.THE_GRAPH]: () => {
    throw new Error("The Graph indexer gateway is not implemented");
  },
  [IndexerGatewayType.PONDER]: () => new PonderIndexerGateway(),
};

/**
 * Factory function to create a indexer gateway instance
 *
 * @param type - The type of indexer gateway to create
 * @returns An instance of the requested indexer gateway
 */
export function createIndexerGateway(): IIndexerGateway {
  const type = process.env.INDEXER_GATEWAY_TYPE as IndexerGatewayType;
  if (!type) {
    throw new Error("INDEXER_GATEWAY_TYPE is not set");
  }

  const factory = registry[type];
  if (!factory) {
    throw new Error(`Unknown indexer gateway type: ${type}`);
  }
  return factory();
}
