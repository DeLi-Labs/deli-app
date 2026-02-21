import type { AuthSig } from "@lit-protocol/types";
import formidable from "formidable";
import type { Address, TypedData } from "viem";
import { SessionKeyPair } from "~~/utils/lit/client";

export type IP = {
  tokenId: number;
  name: string;
  description: string;
  campaigns: Campaign[];
};

export type IPList = IP[];

export type IPDetails = {
  tokenId: number;
  owner: Address;
  name: string;
  description: string;
  image: string;
  externalUrl: string;
  attachments: Attachment[];
};

export type Attachment = {
  name: string;
  type: "ENCRYPTED" | "PLAIN";
  description: string;
  fileType: string;
  fileSizeBytes: number;
  uri: string;
};

export type Campaign = {
  licenseAddress: string;
  numeraireAddress: string;
  poolId: string;
  denomination: {
    unit: "PER_ITEM" | "PER_HOUR" | "PER_DAY" | "PER_BYTE" | "PER_1000_TOKEN";
    amount: number;
  };
};

export type UploadFormData = {
  name: string;
  description: string;
  image: formidable.File;
  externalUrl?: string;
  attachments: Array<{
    file: formidable.File;
    name: string;
    description: string;
    type: "ENCRYPTED" | "PLAIN";
  }>;
};

export type CampaignUploadFormData = {
  denominationUnit: "PER_ITEM" | "PER_HOUR" | "PER_DAY" | "PER_BYTE" | "PER_1000_TOKEN";
  denominationAmount: number;
};

// Permit2 PermitSingle typed data structure for EIP-712 signing
// This matches the structure required by viem's signTypedData
export type Permit2TypedData = {
  PermitSingle: [
    { name: "details"; type: "PermitDetails" },
    { name: "spender"; type: "address" },
    { name: "sigDeadline"; type: "uint256" },
  ];
  PermitDetails: [
    { name: "token"; type: "address" },
    { name: "amount"; type: "uint160" },
    { name: "expiration"; type: "uint48" },
    { name: "nonce"; type: "uint48" },
  ];
} & TypedData;

// Permit message structure for EIP-712 signing
// Note: Values are kept as strings/numbers for JSON serialization in API responses
// but TypeScript types ensure they match Address and numeric types
export type PermitMessage = {
  domain: {
    name: "Permit2";
    chainId: number;
    verifyingContract: Address;
  };
  types: Permit2TypedData;
  primaryType: "PermitSingle";
  message: {
    details: {
      token: Address;
      amount: string; // uint160 as string for JSON serialization (can be converted to bigint)
      expiration: string; // uint48 as string for JSON serialization (can be converted to number)
      nonce: string; // uint48 as string for JSON serialization (can be converted to number)
    };
    spender: Address;
    sigDeadline: string; // uint256 as string for JSON serialization (can be converted to bigint)
  };
};

export type PermitSingle = {
  details: {
    token: Address;
    amount: bigint;
    expiration: bigint;
    nonce: bigint;
  };
  spender: Address;
  sigDeadline: bigint;
};

export type TxData = {
  chainId: number;
  payload: {
    to: Address;
    data: `0x${string}`;
    value?: `0x${string}`;
  };
};

export type QuoteResponse = {
  amountIn: number;
  amountOut: number;
  requiresSignature: boolean;
  permitMessage?: PermitMessage;
  instructions?: string;
  txData?: TxData;
};

export type QuoteRequest = {
  amount: number;
  userAddress: string;
  permit?: {
    message: PermitMessage;
    signature: string;
  };
};

export type PrepareAuthorizeResponse = {
  amount: number;
  requiresSignature: boolean;
  permitMessage?: PermitTransferFromMessage;
  paymentInfo?: PaymentInfoDto;
  instructions?: string;
  txData?: TxData;
};

// Permit2 SignatureTransfer PermitTransferFrom typed data structure for EIP-712 signing
export type PermitTransferFromTypedData = {
  PermitTransferFrom: [
    { name: "permitted"; type: "TokenPermissions" },
    { name: "spender"; type: "address" },
    { name: "nonce"; type: "uint256" },
    { name: "deadline"; type: "uint256" },
  ];
  TokenPermissions: [{ name: "token"; type: "address" }, { name: "amount"; type: "uint256" }];
} & TypedData;

// PermitTransferFrom message structure for EIP-712 signing (SignatureTransfer)
// Used by Permit2PaymentCollector for authorize flow
export type PermitTransferFromMessage = {
  domain: {
    name: "Permit2";
    chainId: number;
    verifyingContract: Address;
  };
  types: PermitTransferFromTypedData;
  primaryType: "PermitTransferFrom";
  message: {
    permitted: {
      token: Address;
      amount: string; // uint256 as string for JSON serialization
    };
    spender: Address;
    nonce: string; // uint256 as string for JSON serialization
    deadline: string; // uint256 as string for JSON serialization
  };
};

// TypeScript mirror of the Solidity PaymentInfo struct from AuthCaptureEscrow
// Serialized with string values for safe JSON transport
export type PaymentInfoDto = {
  operator: Address;
  payer: Address;
  receiver: Address;
  token: Address;
  maxAmount: string; // uint120 as string
  preApprovalExpiry: string; // uint48 as string
  authorizationExpiry: string; // uint48 as string
  refundExpiry: string; // uint48 as string
  minFeeBps: number; // uint16
  maxFeeBps: number; // uint16
  feeReceiver: Address;
  salt: string; // uint256 as string
};

export type SIWEChallengeResponse = {
  message: string;
  opaqueToken: string;
  siwe: string;
};

export type DecryptAuth = {
  authSig: AuthSig;
  sessionKeyPair: SessionKeyPair;
  domain: string;
};
