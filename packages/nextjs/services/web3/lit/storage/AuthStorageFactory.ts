import { RainbowKitWalletType } from "../wallet/types";
import { LocalAuthStorage } from "./LocalAuthStorage";
import type { IAuthStorage } from "./storage";

const registry: Record<RainbowKitWalletType, () => IAuthStorage> = {
  [RainbowKitWalletType.GOOGLE]: () =>
    new LocalAuthStorage(
      `lit_${RainbowKitWalletType.GOOGLE}_auth_data`,
      `lit_${RainbowKitWalletType.GOOGLE}_auth_expiry`,
      60 * 60 * 1000,
    ),
};

/** Creates an auth storage instance for the given wallet type. */
export function createAuthStorage(type: RainbowKitWalletType): IAuthStorage {
  const factory = registry[type];
  if (!factory) {
    throw new Error(`Unknown auth storage type: "${type}". Valid types: ${Object.keys(registry).join(", ")}`);
  }
  return factory();
}
