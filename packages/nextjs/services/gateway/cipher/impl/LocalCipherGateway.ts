import type {
  DecryptOptions,
  DecryptionResult,
  EncryptOptions,
  EncryptableData,
  EncryptionResult,
  ICipherGateway,
} from "../cipher";
import { EncryptedData } from "../cipher";
import type { AccessControlConditions } from "@lit-protocol/types";
import { buildAuthContextForDecrypt } from "~~/utils/auth";
import { getLitClient } from "~~/utils/lit/client";

/** Default ACC used for encrypt/decrypt; export so attachment provider can compute resourceId for 401 challenge. */
export const DEFAULT_ACCESS_CONTROL_CONDITIONS: AccessControlConditions = [
  {
    contractAddress: "",
    standardContractType: "",
    chain: "ethereum",
    method: "eth_getBalance",
    parameters: [":userAddress", "latest"],
    returnValueTest: {
      comparator: ">=",
      value: "0",
    },
  },
];

export class LocalCipherGatewayFrontend implements ICipherGateway {
  private accessControlConditions: AccessControlConditions = DEFAULT_ACCESS_CONTROL_CONDITIONS;

  /**
   * Convert various data types to Uint8Array
   */
  private async dataToUint8Array(data: EncryptableData): Promise<Uint8Array> {
    if (data instanceof Uint8Array) {
      return data;
    }

    if (typeof data === "string") {
      return new TextEncoder().encode(data);
    }

    if (data instanceof File || data instanceof Blob) {
      const arrayBuffer = await data.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    throw new Error(`Unsupported data type: ${typeof data}`);
  }

  async encrypt(data: EncryptableData, options?: EncryptOptions): Promise<EncryptionResult> {
    const litClient = await getLitClient();
    const dataUint8Array = await this.dataToUint8Array(data);

    const accessControlConditions = this.accessControlConditions.map((condition, index) => ({
      ...condition,
      chain: options?.chain || this.accessControlConditions[index].chain,
    }));

    const encryptResponse = await litClient.encrypt({
      dataToEncrypt: dataUint8Array,
      accessControlConditions: accessControlConditions,
    });

    const encryptedData = new EncryptedData(
      encryptResponse.ciphertext,
      encryptResponse.dataToEncryptHash,
      options?.metadata || {},
    );

    return {
      ciphertext: encryptedData,
    };
  }

  async decrypt(encryptedData: EncryptedData, options: DecryptOptions): Promise<DecryptionResult> {
    const litClient = await getLitClient();

    const authContext = await buildAuthContextForDecrypt(
      this.accessControlConditions,
      encryptedData.getHash().toString(),
      options.auth.authSig,
      options.auth.sessionKeyPair,
      options.domain,
    );

    // getData() returns Uint8Array of UTF-8 bytes; decode back to the original string
    const ciphertext = new TextDecoder().decode(encryptedData.getData());
    const dataToEncryptHash = encryptedData.getHash();

    const decryptResponse = await litClient.decrypt({
      ciphertext,
      dataToEncryptHash,
      accessControlConditions: this.accessControlConditions,
      authContext: authContext,
    });

    return {
      decryptedData: decryptResponse.decryptedData,
      metadata: encryptedData.getMetadata(),
    };
  }
}
