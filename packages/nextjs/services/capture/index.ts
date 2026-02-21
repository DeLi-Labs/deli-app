import { LitPkpCaptureService } from "./impl/LitPkpCaptureService";
import type { Address } from "viem";
import type { PaymentInfoDto } from "~~/types/liquidip";

export type CaptureParams = {
  pkpAddress: Address;
  paymentInfo: PaymentInfoDto;
  amount: bigint;
};

export type CaptureResult = {
  success: boolean;
  txHash?: `0x${string}`;
  error?: string;
};

export interface ICaptureService {
  capture(params: CaptureParams): Promise<CaptureResult>;
}

export { LitPkpCaptureService };

let captureServiceInstance: ICaptureService | null = null;

export function createCaptureService(): ICaptureService {
  if (!captureServiceInstance) {
    captureServiceInstance = new LitPkpCaptureService();
  }
  return captureServiceInstance;
}
