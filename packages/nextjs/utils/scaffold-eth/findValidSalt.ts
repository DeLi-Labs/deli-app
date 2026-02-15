import { createPublicClient, http } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import scaffoldConfig from "~~/scaffold.config";

function getPublicClient(chainId: number) {
  const chain = scaffoldConfig.targetNetworks.find(n => n.id === chainId);
  if (!chain) {
    throw new Error(`Chain ${chainId} not found in scaffold config`);
  }

  const rpcOverrides = scaffoldConfig.rpcOverrides as Record<number, string> | undefined;
  const rpcUrl = rpcOverrides?.[chainId] ?? chain.rpcUrls?.default?.http?.[0];

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Finds a valid salt that satisfies Uniswap v4 requirements by calling the pure validateAssetOrder function.
 * Tries random salts until finding one where the computed license address > numeraire address.
 *
 * @param numeraireAddress - Address of the numeraire token
 * @param metadataUri - Metadata URI for the license
 * @param patentId - Patent token ID
 * @param licenseType - License type (0 = SingleUse)
 * @param patentErc721Address - Address of the IPERC721 contract
 * @param campaignManagerAddress - Address of the CampaignManager contract
 * @param chainId - Chain ID to use (defaults to first network in scaffold config)
 * @param maxAttempts - Maximum number of salt attempts (default: 10000)
 * @returns Valid salt bytes32 that satisfies the requirement
 * @throws Error if no valid salt found after maxAttempts
 */
export async function findValidSalt(
  numeraireAddress: `0x${string}`,
  metadataUri: string,
  patentId: bigint,
  licenseType: number,
  patentErc721Address: `0x${string}`,
  campaignManagerAddress: `0x${string}`,
  chainId?: number,
  maxAttempts: number = 10000,
): Promise<`0x${string}`> {
  const targetChainId = chainId ?? scaffoldConfig.targetNetworks[0].id;
  const client = getPublicClient(targetChainId);

  // Get CampaignManager ABI from deployed contracts
  const chainContracts = (
    deployedContracts as Record<number, Record<string, { address: string; abi: readonly unknown[] }>>
  )[targetChainId];
  const campaignManagerContract = chainContracts?.CampaignManager;
  if (!campaignManagerContract) {
    throw new Error(`CampaignManager contract not found on chain ${targetChainId}`);
  }

  // Try different salts until we find one that passes validation
  for (let i = 0; i < maxAttempts; i++) {
    // Generate random salt (32 bytes)
    const saltBytes = new Uint8Array(32);
    for (let j = 0; j < 32; j++) {
      saltBytes[j] = Math.floor(Math.random() * 256);
    }
    const salt = `0x${Array.from(saltBytes)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")}` as `0x${string}`;

    try {
      // Call the pure validateAssetOrder function
      // Since it's pure, it will revert if the salt is invalid
      await client.readContract({
        address: campaignManagerAddress,
        abi: [...campaignManagerContract.abi],
        functionName: "validateAssetOrder",
        args: [numeraireAddress, salt, metadataUri, patentId, licenseType, patentErc721Address, campaignManagerAddress],
      });

      // If we reach here, validation passed - return the valid salt
      return salt;
    } catch {
      // Validation failed, try next salt
      continue;
    }
  }

  throw new Error(
    `Could not find valid salt after ${maxAttempts} attempts. Try a different numeraire address or increase maxAttempts.`,
  );
}
