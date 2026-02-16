import { RainbowKitWalletType } from "../wallet/types";
import type { ILitAuthenticator } from "./authenticator";
import { GoogleLitAuthenticator } from "./impl/GoogleLitAuthenticator";

const registry: Record<RainbowKitWalletType, () => ILitAuthenticator> = {
  [RainbowKitWalletType.GOOGLE]: () => new GoogleLitAuthenticator(),
};

/**
 * Factory function to create a lit authenticator instance
 *
 * @param type - The type of lit authenticator to create
 * @returns An instance of the requested lit authenticator
 */
export function createLitAuthenticator(type: RainbowKitWalletType): ILitAuthenticator {
  const factory = registry[type];
  if (!factory) {
    throw new Error(`Unknown lit authenticator type: "${type}". Valid types are: ${Object.keys(registry).join(", ")}`);
  }
  return factory();
}
