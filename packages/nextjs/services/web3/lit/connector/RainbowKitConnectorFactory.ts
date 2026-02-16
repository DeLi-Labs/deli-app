import { RainbowKitWalletType } from "../wallet/types";
import { RainbowKitConnector } from "./RainbowKitConnector";
import type { ILitConnector } from "./connector";

const registry: Record<RainbowKitWalletType, () => ILitConnector> = {
  [RainbowKitWalletType.GOOGLE]: () => new RainbowKitConnector(RainbowKitWalletType.GOOGLE),
};

/** Creates a RainbowKit-compatible Lit connector for the given wallet type. */
export function createRainbowKitConnector(type: RainbowKitWalletType): ILitConnector {
  const factory = registry[type];
  if (!factory) {
    throw new Error(`Unknown connector type: "${type}". Valid types: ${Object.keys(registry).join(", ")}`);
  }
  return factory();
}
