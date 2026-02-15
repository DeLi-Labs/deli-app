import type { ICipherGateway } from "./cipher";
import { LitCipherGatewayFrontend } from "./impl/LitCipherGateway";
import { LocalCipherGatewayFrontend } from "./impl/LocalCipherGateway";

export const enum CipherGatewayType {
  LOCAL = "LOCAL",
  LIT = "LIT",
}

const registry: Record<CipherGatewayType, () => ICipherGateway> = {
  [CipherGatewayType.LOCAL]: () => new LocalCipherGatewayFrontend(),
  [CipherGatewayType.LIT]: () => new LitCipherGatewayFrontend(),
};

/**
 * Factory function to create a cipher gateway instance
 *
 * @param type - The type of cipher gateway to create
 * @returns An instance of the requested cipher gateway
 */
export function createCipherGateway(): ICipherGateway {
  const type = process.env.NEXT_PUBLIC_CIPHER_GATEWAY_TYPE as CipherGatewayType;
  if (!type) {
    throw new Error("NEXT_PUBLIC_CIPHER_GATEWAY_TYPE is not set");
  }

  const factory = registry[type];
  if (!factory) {
    throw new Error(`Unknown storage gateway type: "${type}". Valid types are: ${Object.keys(registry).join(", ")}`);
  }
  return factory();
}
