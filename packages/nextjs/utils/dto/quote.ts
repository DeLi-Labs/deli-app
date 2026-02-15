import { IsNotEmpty, IsNumber, IsString, IsOptional, ValidateNested, Matches, Min, IsInt } from "class-validator";
import { Type } from "class-transformer";

// DTO for permit message (nested validation)
class PermitMessageDTO {
  @IsNotEmpty()
  domain!: {
    name: string;
    chainId: number;
    verifyingContract: string;
  };

  @IsNotEmpty()
  types!: any;

  @IsNotEmpty()
  @IsString()
  primaryType!: string;

  @IsNotEmpty()
  message!: {
    details: {
      token: string;
      amount: string;
      expiration: string;
      nonce: string;
    };
    spender: string;
    sigDeadline: string;
  };
}

// DTO for permit object (nested validation)
class PermitDTO {
  @ValidateNested()
  @Type(() => PermitMessageDTO)
  @IsNotEmpty()
  message!: PermitMessageDTO;

  @IsString()
  @Matches(/^0x[a-fA-F0-9]+$/, { message: "Signature must be a valid hex string starting with 0x" })
  @IsNotEmpty()
  signature!: string;
}

// DTO class for request body validation (used for both quote and authorize endpoints)
export class Permit2RequestDTO {
  @IsNumber()
  @IsInt({ message: "Amount must be an integer" })
  @Min(1, { message: "Amount must be a positive integer" })
  @IsNotEmpty()
  amount!: number;

  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: "userAddress must be a valid Ethereum address" })
  @IsNotEmpty()
  userAddress!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PermitDTO)
  permit?: PermitDTO;

  // Optional PaymentInfo for the authorize flow (returned from first call, sent back on second call)
  @IsOptional()
  paymentInfo?: Record<string, unknown>;
}

// Keep QuoteRequestDTO as an alias for backward compatibility
export class QuoteRequestDTO extends Permit2RequestDTO {}
