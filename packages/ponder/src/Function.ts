import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Load .env file explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env") });

import { ponder } from "ponder:registry";
import { ip, attachment, campaign } from "ponder:schema";
import { zeroAddress } from "viem";
import { createStorageGateway } from "../../nextjs/services/gateway/storage/StorageGatewayFactory";

// Lazy initialization of storage gateway to avoid errors during Ponder startup
let storageGateway: ReturnType<typeof createStorageGateway> | null = null;

function getStorageGateway() {
  if (!storageGateway) {
    try {
      // Debug: log the environment variable value
      const envValue = process.env.STORAGE_GATEWAY_TYPE;
      
      if (!envValue) {
        throw new Error("STORAGE_GATEWAY_TYPE environment variable is not set. Please set it in .env file (IPFS, ARWEAVE, or LOCAL)");
      }
      
      storageGateway = createStorageGateway();
    } catch (error) {
      console.error("[Storage Gateway] Failed to create storage gateway:", error);
      // Re-throw the original error to preserve the actual error message
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
  return storageGateway;
}

ponder.on("IPERC721:Transfer", async ({ event, context }) => {
  // Check if this is a mint event (from address is zero address)
  const isMint = event.args.from === zeroAddress;

  if (!isMint) {
    return; // Skip non-mint transfers
  }

  const tokenId = event.args.tokenId;
  const contract = context.contracts.IPERC721;

  if (!contract) {
    console.error("IPERC721 contract not found in context.contracts");
    return;
  }

  try {
    // Read tokenURI from the contract
    const tokenUri = await context.client.readContract({
      abi: contract.abi,
      address: contract.address,
      functionName: "tokenURI",
      args: [tokenId],
    });

    if (!tokenUri) {
      console.warn(`No tokenURI found for tokenId ${tokenId}`);
      return;
    }

    // Fetch NFT metadata using storage gateway
    const metadata = await getStorageGateway().retrieveJson<{
      name: string;
      description: string;
      image: string;
      externalUrl: string;
      attachments?: Array<{
        name: string;
        type: "ENCRYPTED" | "PLAIN";
        description: string;
        fileType: string;
        fileSizeBytes: number;
        uri: string;
      }>;
    }>(tokenUri);

    // Validate required fields
    if (!metadata.name || !metadata.description || !metadata.image || !metadata.externalUrl) {
      console.warn(`Incomplete metadata for tokenId ${tokenId}:`, metadata);
    }

    const ipId = `${contract.address}-${tokenId}`;
    const owner = (event.args.to as string).toLowerCase();

    // Insert IP into database
    await context.db.insert(ip).values({
      id: ipId,
      tokenId: tokenId,
      owner,
      name: metadata.name,
      description: metadata.description,
      image: metadata.image,
      externalUrl: metadata.externalUrl,
    });

    // Insert attachments if they exist
    if (metadata.attachments && metadata.attachments.length > 0) {
      const attachmentValues = metadata.attachments.map((att, index) => ({
        id: `${ipId}-attachment-${index}`,
        ipId: ipId,
        name: att.name,
        type: att.type,
        description: att.description,
        fileType: att.fileType,
        fileSizeBytes: BigInt(att.fileSizeBytes),
        uri: att.uri,
      }));

      await context.db.insert(attachment).values(attachmentValues);
    }
  } catch (error) {
    console.error(`Error processing mint for tokenId ${tokenId}:`, error);
    // Don't throw - allow indexing to continue for other events
  }
});

ponder.on("CampaignManager:CampaignInitialized", async ({ event, context }) => {
  const patentId = event.args.patentId;
  const licenseAddress = event.args.license;
  const numeraireAddress = event.args.numeraire;
  const poolId = event.args.poolId;

  const campaignManagerContract = context.contracts.CampaignManager;
  const licenseContract = context.contracts.LicenseERC20;

  if (!campaignManagerContract) {
    console.error("CampaignManager contract not found in context.contracts");
    return;
  }

  if (!licenseContract) {
    console.error("LicenseERC20 contract not found in context.contracts");
    return;
  }

  try {
    // Read patentErc721 address from CampaignManager
    const patentErc721Address = await context.client.readContract({
      abi: campaignManagerContract.abi,
      address: campaignManagerContract.address,
      functionName: "patentErc721",
    });

    if (!patentErc721Address) {
      console.error(`No patentErc721 address found in CampaignManager`);
      return;
    }

    // Normalize address to lowercase to match IP id format
    const normalizedPatentErc721Address = (patentErc721Address as string).toLowerCase();

    // Read licenceMetadataUri from LicenseERC20 contract (using ABI from deployed contracts but address from event)
    const licenceMetadataUri = await context.client.readContract({
      abi: licenseContract.abi,
      address: licenseAddress,
      functionName: "licenceMetadataUri",
    });

    if (!licenceMetadataUri) {
      console.warn(`No licenceMetadataUri found for license ${licenseAddress}`);
      return;
    }

    // Fetch campaign metadata using storage gateway
    const metadata = await getStorageGateway().retrieveJson<{
      denomination: {
        unit: "PER_ITEM" | "PER_HOUR" | "PER_DAY" | "PER_BYTE" | "PER_1000_TOKEN";
        amount: number | string;
      };
    }>(licenceMetadataUri);

    // Validate required fields
    if (!metadata.denomination || !metadata.denomination.unit || metadata.denomination.amount === undefined) {
      console.warn(`Incomplete campaign metadata for license ${licenseAddress}:`, metadata);
      return;
    }

    // Use normalized address to match IP id format (IPs are created with lowercase contract.address)
    // This ensures the foreign key relationship works correctly
    const ipId = `${normalizedPatentErc721Address}-${patentId}`;
    const campaignId = `${ipId}-campaign-${licenseAddress.toLowerCase()}`;
    
    // Note: If the IP doesn't exist yet (e.g., events processed out of order), the campaign will still be created.
    // The relationship will resolve automatically once the IP Transfer event is processed and the IP is indexed.

    // Convert denomination amount to BigInt
    const denominationAmount = BigInt(
      typeof metadata.denomination.amount === "string"
        ? metadata.denomination.amount
        : metadata.denomination.amount.toString()
    );

    // Insert campaign into database
    await context.db.insert(campaign).values({
      id: campaignId,
      ipId: ipId,
      licenseAddress: licenseAddress.toLowerCase(),
      numeraireAddress: numeraireAddress.toLowerCase(),
      poolId: poolId,
      denominationUnit: metadata.denomination.unit,
      denominationAmount: denominationAmount,
    });
  } catch (error) {
    console.error(`Error processing campaign initialization for patentId ${patentId}:`, error);
    // Don't throw - allow indexing to continue for other events
  }
});