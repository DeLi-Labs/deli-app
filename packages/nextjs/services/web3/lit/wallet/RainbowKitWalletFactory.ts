import { createRainbowKitConnector } from "../connector/RainbowKitConnectorFactory";
import { RainbowKitWalletType, TypeToIconBackground, TypeToIconUrl, TypeToId, TypeToName } from "./types";
import type { Wallet } from "@rainbow-me/rainbowkit";

/**
 * Creates a RainbowKit Wallet factory for the given Lit wallet type.
 * Returns a function (as RainbowKit expects) that produces the Wallet config.
 */
export function createRainbowKitWallet(type: RainbowKitWalletType): () => Wallet {
  return () => ({
    id: TypeToId[type],
    name: TypeToName[type],
    iconUrl: TypeToIconUrl[type],
    iconBackground: TypeToIconBackground[type],
    createConnector: createRainbowKitConnector(type).createConnector,
  });
}
