import type { WalletDetailsParams } from "@rainbow-me/rainbowkit";
import type { CreateConnectorFn } from "wagmi";

export interface ILitConnector {
  createConnector(walletDetails: WalletDetailsParams): CreateConnectorFn;
}
