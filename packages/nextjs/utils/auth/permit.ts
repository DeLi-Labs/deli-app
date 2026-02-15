import { type Address, recoverTypedDataAddress } from "viem";
import type { PermitMessage, PermitTransferFromMessage } from "~~/types/liquidip";

export type PermitValidationParams = {
  chainId: number;
  permit2Address: Address;
  tokenAddress: Address;
  routerAddress: Address;
  userAddress: Address;
  amountInRaw: bigint;
};

export type PermitValidationResult = {
  valid: boolean;
  error?: string;
  details?: string;
};

/**
 * Validate AllowanceTransfer PermitSingle message and signature.
 * Used by the quote/swap flow.
 */
export const validatePermitMessage = async (
  permitMessage: PermitMessage,
  signature: string,
  params: PermitValidationParams,
): Promise<PermitValidationResult> => {
  const { chainId, permit2Address, tokenAddress, routerAddress, userAddress, amountInRaw } = params;

  // Validate domain
  if (
    permitMessage.domain?.name !== "Permit2" ||
    permitMessage.domain?.chainId !== chainId ||
    permitMessage.domain?.verifyingContract?.toLowerCase() !== permit2Address.toLowerCase()
  ) {
    return {
      valid: false,
      error: "Invalid permit domain",
      details: "Domain must match Permit2 configuration for this chain",
    };
  }

  // Validate permit message values against expected values
  if (permitMessage.message.details.token.toLowerCase() !== tokenAddress.toLowerCase()) {
    return {
      valid: false,
      error: "Invalid permit token address",
      details: `Token address must be ${tokenAddress}`,
    };
  }

  if (permitMessage.message.spender.toLowerCase() !== routerAddress.toLowerCase()) {
    return {
      valid: false,
      error: "Invalid permit spender address",
      details: `Spender address must be ${routerAddress}`,
    };
  }

  // Validate amount - permit amount must be >= calculated amountInRaw
  const permitAmount = BigInt(permitMessage.message.details.amount);
  if (permitAmount < amountInRaw) {
    return {
      valid: false,
      error: "Insufficient permit amount",
      details: `Permit amount ${permitAmount.toString()} is less than required ${amountInRaw.toString()}`,
    };
  }

  // Validate signature recovers to userAddress
  try {
    const recoveredAddress = await recoverTypedDataAddress({
      domain: permitMessage.domain,
      types: permitMessage.types,
      primaryType: permitMessage.primaryType,
      message: permitMessage.message,
      signature: signature as `0x${string}`,
    });

    if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return {
        valid: false,
        error: "Invalid signature",
        details: `Signature does not recover to ${userAddress}. Recovered: ${recoveredAddress}`,
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: "Failed to verify signature",
      details: error instanceof Error ? error.message : String(error),
    };
  }

  return { valid: true };
};

export type PermitTransferFromValidationParams = {
  chainId: number;
  permit2Address: Address;
  tokenAddress: Address;
  spenderAddress: Address;
  userAddress: Address;
  amountRaw: bigint;
};

/**
 * Validate SignatureTransfer PermitTransferFrom message and signature.
 * Used by the authorize flow with Permit2PaymentCollector.
 */
export const validatePermitTransferFromMessage = async (
  permitMessage: PermitTransferFromMessage,
  signature: string,
  params: PermitTransferFromValidationParams,
): Promise<PermitValidationResult> => {
  const { chainId, permit2Address, tokenAddress, spenderAddress, userAddress, amountRaw } = params;

  // Validate domain
  if (
    permitMessage.domain?.name !== "Permit2" ||
    permitMessage.domain?.chainId !== chainId ||
    permitMessage.domain?.verifyingContract?.toLowerCase() !== permit2Address.toLowerCase()
  ) {
    return {
      valid: false,
      error: "Invalid permit domain",
      details: "Domain must match Permit2 configuration for this chain",
    };
  }

  // Validate token address
  if (permitMessage.message.permitted.token.toLowerCase() !== tokenAddress.toLowerCase()) {
    return {
      valid: false,
      error: "Invalid permit token address",
      details: `Token address must be ${tokenAddress}`,
    };
  }

  // Validate spender (Permit2PaymentCollector)
  if (permitMessage.message.spender.toLowerCase() !== spenderAddress.toLowerCase()) {
    return {
      valid: false,
      error: "Invalid permit spender address",
      details: `Spender address must be ${spenderAddress}`,
    };
  }

  // Validate amount
  const permitAmount = BigInt(permitMessage.message.permitted.amount);
  if (permitAmount < amountRaw) {
    return {
      valid: false,
      error: "Insufficient permit amount",
      details: `Permit amount ${permitAmount.toString()} is less than required ${amountRaw.toString()}`,
    };
  }

  // Validate signature recovers to userAddress
  try {
    const recoveredAddress = await recoverTypedDataAddress({
      domain: permitMessage.domain,
      types: permitMessage.types,
      primaryType: permitMessage.primaryType,
      message: permitMessage.message,
      signature: signature as `0x${string}`,
    });

    if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return {
        valid: false,
        error: "Invalid signature",
        details: `Signature does not recover to ${userAddress}. Recovered: ${recoveredAddress}`,
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: "Failed to verify signature",
      details: error instanceof Error ? error.message : String(error),
    };
  }

  return { valid: true };
};
