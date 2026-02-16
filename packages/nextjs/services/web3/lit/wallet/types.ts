/** Runtime enum (not const enum) so the value survives bundling into all chunks. */
export enum RainbowKitWalletType {
  GOOGLE = "google",
}

export const TypeToId: Record<RainbowKitWalletType, string> = {
  [RainbowKitWalletType.GOOGLE]: "google-pkp",
};

export const TypeToName: Record<RainbowKitWalletType, string> = {
  [RainbowKitWalletType.GOOGLE]: "Sign In With Google",
};

export const TypeToIconUrl: Record<RainbowKitWalletType, string> = {
  [RainbowKitWalletType.GOOGLE]: "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg",
};

export const TypeToIconBackground: Record<RainbowKitWalletType, string> = {
  [RainbowKitWalletType.GOOGLE]: "#FFFFFF",
};
