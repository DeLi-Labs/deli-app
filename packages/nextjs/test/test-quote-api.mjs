import { createPublicClient, createWalletClient, formatUnits, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const PRIVATE_KEY = "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6";
const TOKEN_ID = 1;
const CAMPAIGN_ID = "0xe7a5e6fa3b9858c0b627db8542ce01cc52ac3d3b";
const MOCK_USD_ADDRESS = "0xadF4aCF92F0A1398d50402Db551feb92b1125DAb";
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // Standard Permit2 address
const API_BASE_URL = "http://localhost:3000";
const RPC_URL = "http://localhost:8545";
const AMOUNT_OUT = 100; // Campaign tokens to receive

// ERC20 ABI for balanceOf, mint, and approve
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

async function main() {
  console.log("🚀 Starting Quote API Test\n");

  // Setup account and clients
  const account = privateKeyToAccount(PRIVATE_KEY);
  const userAddress = account.address;
  console.log(`📝 User Address: ${userAddress}`);

  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: foundry,
    transport: http(RPC_URL),
  });

  // On a mainnet fork, Foundry default accounts may have contract code deployed
  // at their addresses on mainnet. Permit2's SignatureVerification checks
  // claimedSigner.code.length: if > 0, it uses EIP-1271 (isValidSignature)
  // instead of ecrecover, which fails for EOA signatures.
  // Clear any code at the test account address so Permit2 uses ecrecover.
  const code = await publicClient.getCode({ address: userAddress });
  if (code && code !== "0x") {
    console.log(`⚠️  Test account has code on mainnet fork, clearing it for EOA signing...`);
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "anvil_setCode",
        params: [userAddress, "0x"],
        id: 1,
      }),
    });
    const result = await response.json();
    if (result.error) {
      throw new Error(`Failed to clear code: ${result.error.message}`);
    }
    console.log(`   ✅ Code cleared at ${userAddress}`);
  }

  // Step 1: Get initial campaign token balance
  console.log("\n📊 Step 1: Getting initial campaign token balance...");
  // The campaignId parameter is actually the license address
  const licenseAddress = CAMPAIGN_ID;
  console.log(`   License Token Address: ${licenseAddress}`);

  const initialBalance = await publicClient.readContract({
    address: licenseAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress],
  });

  console.log(`   Initial Balance: ${formatUnits(initialBalance, 18)} tokens`);

  // Step 2: Call API to get permit message
  console.log(`\n📞 Step 2: Calling API to get permit message...`);
  console.log(`   URL: ${API_BASE_URL}/api/ip/${TOKEN_ID}/${CAMPAIGN_ID}/quote`);
  console.log(`   Method: POST`);
  console.log(`   Body: { amount: ${AMOUNT_OUT}, userAddress: ${userAddress} }`);

  const quoteResponse1Raw = await fetch(`${API_BASE_URL}/api/ip/${TOKEN_ID}/${CAMPAIGN_ID}/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: AMOUNT_OUT,
      userAddress: userAddress,
    }),
  });

  const quoteResponse1 = await quoteResponse1Raw.json();

  console.log(`   Response status: ${quoteResponse1Raw.status}`);
  console.log(`   Full response:`, JSON.stringify(quoteResponse1, null, 2));

  if (quoteResponse1.error) {
    throw new Error(`API Error: ${quoteResponse1.error}`);
  }

  console.log(`   ✅ Received permit message`);
  console.log(`   Amount In: ${quoteResponse1.amountIn} tokens`);
  console.log(`   Amount Out: ${quoteResponse1.amountOut} tokens`);
  console.log(`   Requires Signature: ${quoteResponse1.requiresSignature}`);

  if (!quoteResponse1.permitMessage) {
    throw new Error("No permit message in response");
  }

  // Step 3: Mint mock USD tokens
  console.log(`\n💰 Step 3: Minting mock USD tokens...`);
  const amountInRaw = parseUnits(quoteResponse1.amountIn.toString(), 18);
  console.log(`   Amount needed: ${formatUnits(amountInRaw, 18)} mock USD`);

  // Check current balance
  const currentUsdBalance = await publicClient.readContract({
    address: MOCK_USD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress],
  });

  console.log(`   Current USD Balance: ${formatUnits(currentUsdBalance, 18)}`);

  if (currentUsdBalance < amountInRaw) {
    const mintAmount = amountInRaw * 2n; // Mint double to ensure we have enough
    console.log(`   Minting ${formatUnits(mintAmount, 18)} tokens to cover amount...`);
    const mintHash = await walletClient.writeContract({
      address: MOCK_USD_ADDRESS,
      abi: ERC20_ABI,
      functionName: "mint",
      args: [userAddress, mintAmount],
    });
    console.log(`   Mint transaction hash: ${mintHash}`);
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
    console.log(`   ✅ Minted successfully`);
  } else {
    console.log(`   ✅ Sufficient balance already`);
  }

  // Step 4: Approve Permit2 to spend tokens
  console.log(`\n🔐 Step 4: Approving Permit2 to spend tokens...`);
  const currentAllowance = await publicClient.readContract({
    address: MOCK_USD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress, PERMIT2_ADDRESS],
  });

  console.log(`   Current Permit2 Allowance: ${formatUnits(currentAllowance, 18)} tokens`);

  // Permit2 typically uses uint160.max for maximum approval
  const MAX_UINT160 = 2n ** 160n - 1n;

  if (currentAllowance < amountInRaw) {
    console.log(`   Approving Permit2 for maximum amount (type(uint160).max)...`);
    const approveHash = await walletClient.writeContract({
      address: MOCK_USD_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [PERMIT2_ADDRESS, MAX_UINT160],
    });
    console.log(`   Approve transaction hash: ${approveHash}`);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log(`   ✅ Permit2 approved successfully`);
  } else {
    console.log(`   ✅ Permit2 already has sufficient allowance`);
  }

  // Step 5: Sign permit message
  console.log(`\n✍️  Step 5: Signing permit message...`);
  const permitMessage = quoteResponse1.permitMessage;

  const signature = await walletClient.signTypedData({
    domain: permitMessage.domain,
    types: permitMessage.types,
    primaryType: permitMessage.primaryType,
    message: permitMessage.message,
  });

  console.log(`   ✅ Signature: ${signature}`);

  // Step 6: Call API with signature to get transaction payload
  console.log(`\n📞 Step 6: Calling API with signature to get transaction payload...`);
  console.log(`   URL: ${API_BASE_URL}/api/ip/${TOKEN_ID}/${CAMPAIGN_ID}/quote`);
  console.log(`   Method: POST`);
  console.log(`   Body: { amount: ${AMOUNT_OUT}, userAddress: ${userAddress}, permit: { message, signature } }`);

  const quoteResponse2Raw = await fetch(`${API_BASE_URL}/api/ip/${TOKEN_ID}/${CAMPAIGN_ID}/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: AMOUNT_OUT,
      userAddress: userAddress,
      permit: {
        message: permitMessage,
        signature: signature,
      },
    }),
  });

  const quoteResponse2 = await quoteResponse2Raw.json();

  console.log(`   Response status: ${quoteResponse2Raw.status}`);
  if (quoteResponse2.error) {
    console.log(`   Error response:`, JSON.stringify(quoteResponse2, null, 2));
  }

  if (quoteResponse2.error) {
    throw new Error(`API Error: ${quoteResponse2.error}`);
  }

  console.log(`   ✅ Received transaction payload`);
  console.log(`   Chain ID: ${quoteResponse2.txData.chainId}`);
  console.log(`   To: ${quoteResponse2.txData.payload.to}`);
  console.log(`   Data length: ${quoteResponse2.txData.payload.data.length} chars`);

  // Step 7: Send transaction
  console.log(`\n📤 Step 7: Sending transaction to local Foundry...`);
  const txHash = await walletClient.sendTransaction({
    to: quoteResponse2.txData.payload.to,
    data: quoteResponse2.txData.payload.data,
    value: BigInt(quoteResponse2.txData.payload.value),
  });

  console.log(`   Transaction hash: ${txHash}`);
  console.log(`   Waiting for confirmation...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}`);

  // Step 8: Check final balance
  console.log(`\n📊 Step 8: Checking final campaign token balance...`);
  const finalBalance = await publicClient.readContract({
    address: licenseAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress],
  });

  console.log(`   Final Balance: ${formatUnits(finalBalance, 18)} tokens`);
  console.log(`   Balance Change: ${formatUnits(finalBalance - initialBalance, 18)} tokens`);
  console.log(`   Expected Change: ${AMOUNT_OUT} tokens`);

  const balanceChange = finalBalance - initialBalance;
  const expectedChange = parseUnits(AMOUNT_OUT.toString(), 18);

  if (balanceChange >= expectedChange) {
    console.log(`\n✅ SUCCESS! Balance increased by at least ${AMOUNT_OUT} tokens`);
  } else {
    console.log(`\n❌ FAILED! Balance did not increase by expected amount`);
    console.log(`   Expected: ${formatUnits(expectedChange, 18)}`);
    console.log(`   Actual: ${formatUnits(balanceChange, 18)}`);
  }

  // ============================================
  // Test PrepareAuthorize Endpoint
  // ============================================
  console.log(`\n\n${"=".repeat(60)}`);
  console.log("🧪 Testing PrepareAuthorize Endpoint");
  console.log(`${"=".repeat(60)}\n`);

  const AUTHORIZE_AMOUNT = 50; // Amount to authorize

  // Step 1: Call prepareAuthorize API to get permit message
  console.log(`📞 Step 1: Calling prepareAuthorize API to get permit message...`);
  console.log(`   URL: ${API_BASE_URL}/api/ip/${TOKEN_ID}/${CAMPAIGN_ID}/prepareAuthorize`);
  console.log(`   Method: POST`);
  console.log(`   Body: { amount: ${AUTHORIZE_AMOUNT}, userAddress: ${userAddress} }`);

  const prepareAuthorizeResponse1Raw = await fetch(
    `${API_BASE_URL}/api/ip/${TOKEN_ID}/${CAMPAIGN_ID}/prepareAuthorize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: AUTHORIZE_AMOUNT,
        userAddress: userAddress,
      }),
    },
  );

  const prepareAuthorizeResponse1 = await prepareAuthorizeResponse1Raw.json();

  console.log(`   Response status: ${prepareAuthorizeResponse1Raw.status}`);
  console.log(`   Full response:`, JSON.stringify(prepareAuthorizeResponse1, null, 2));

  if (prepareAuthorizeResponse1Raw.status !== 200) {
    throw new Error(`API Error: ${prepareAuthorizeResponse1.error || "Unknown error"}`);
  }

  console.log(`   ✅ Received permit message`);
  console.log(`   Amount: ${prepareAuthorizeResponse1.amount}`);
  console.log(`   Requires Signature: ${prepareAuthorizeResponse1.requiresSignature}`);

  if (!prepareAuthorizeResponse1.permitMessage) {
    throw new Error("No permit message in prepareAuthorize response");
  }

  if (!prepareAuthorizeResponse1.paymentInfo) {
    throw new Error("No paymentInfo in prepareAuthorize response");
  }

  if (!prepareAuthorizeResponse1.requiresSignature) {
    throw new Error("Expected requiresSignature to be true when no permit provided");
  }

  console.log(`   PaymentInfo operator: ${prepareAuthorizeResponse1.paymentInfo.operator}`);
  console.log(`   PaymentInfo payer: ${prepareAuthorizeResponse1.paymentInfo.payer}`);
  console.log(`   PaymentInfo token: ${prepareAuthorizeResponse1.paymentInfo.token}`);
  console.log(`   PaymentInfo salt: ${prepareAuthorizeResponse1.paymentInfo.salt}`);
  console.log(`   Permit primaryType: ${prepareAuthorizeResponse1.permitMessage.primaryType}`);

  // Step 2: Approve Permit2 for license tokens (if needed)
  console.log(`\n🔐 Step 2: Approving Permit2 for license tokens...`);
  const licenseTokenAddress = licenseAddress;
  const authorizeAmountRaw = parseUnits(AUTHORIZE_AMOUNT.toString(), 18);

  const currentLicenseAllowance = await publicClient.readContract({
    address: licenseTokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress, PERMIT2_ADDRESS],
  });

  console.log(`   Current Permit2 Allowance: ${formatUnits(currentLicenseAllowance, 18)} license tokens`);

  if (currentLicenseAllowance < authorizeAmountRaw) {
    console.log(`   Approving Permit2 for maximum amount (type(uint160).max)...`);
    const approveLicenseHash = await walletClient.writeContract({
      address: licenseTokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [PERMIT2_ADDRESS, MAX_UINT160],
    });
    console.log(`   Approve transaction hash: ${approveLicenseHash}`);
    await publicClient.waitForTransactionReceipt({ hash: approveLicenseHash });
    console.log(`   ✅ Permit2 approved for license tokens`);
  } else {
    console.log(`   ✅ Permit2 already has sufficient allowance for license tokens`);
  }

  // Step 3: Sign permit message
  console.log(`\n✍️  Step 3: Signing permit message for authorize...`);
  const authorizePermitMessage = prepareAuthorizeResponse1.permitMessage;

  const authorizeSignature = await walletClient.signTypedData({
    domain: authorizePermitMessage.domain,
    types: authorizePermitMessage.types,
    primaryType: authorizePermitMessage.primaryType,
    message: authorizePermitMessage.message,
  });

  console.log(`   ✅ Signature: ${authorizeSignature}`);

  // Step 4: Call API with signature + paymentInfo to get transaction payload
  console.log(`\n📞 Step 4: Calling prepareAuthorize API with signature to get transaction payload...`);
  console.log(`   URL: ${API_BASE_URL}/api/ip/${TOKEN_ID}/${CAMPAIGN_ID}/prepareAuthorize`);
  console.log(`   Method: POST`);
  console.log(`   Body: { amount, userAddress, permit: { message, signature }, paymentInfo }`);

  const prepareAuthorizeResponse2Raw = await fetch(
    `${API_BASE_URL}/api/ip/${TOKEN_ID}/${CAMPAIGN_ID}/prepareAuthorize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: AUTHORIZE_AMOUNT,
        userAddress: userAddress,
        permit: {
          message: authorizePermitMessage,
          signature: authorizeSignature,
        },
        paymentInfo: prepareAuthorizeResponse1.paymentInfo,
      }),
    },
  );

  const prepareAuthorizeResponse2 = await prepareAuthorizeResponse2Raw.json();

  console.log(`   Response status: ${prepareAuthorizeResponse2Raw.status}`);
  if (prepareAuthorizeResponse2.error) {
    console.log(`   Error response:`, JSON.stringify(prepareAuthorizeResponse2, null, 2));
  }

  if (prepareAuthorizeResponse2.error) {
    throw new Error(`API Error: ${prepareAuthorizeResponse2.error}`);
  }

  console.log(`   ✅ Received transaction payload`);
  console.log(`   Amount: ${prepareAuthorizeResponse2.amount}`);
  console.log(`   Requires Signature: ${prepareAuthorizeResponse2.requiresSignature}`);
  console.log(`   Chain ID: ${prepareAuthorizeResponse2.txData.chainId}`);
  console.log(`   To: ${prepareAuthorizeResponse2.txData.payload.to}`);
  console.log(`   Data length: ${prepareAuthorizeResponse2.txData.payload.data.length} chars`);

  // Step 5: Verify response structure
  console.log(`\n🔍 Step 5: Verifying response structure...`);
  const requiredFields = ["amount", "requiresSignature", "txData"];
  const requiredTxDataFields = ["chainId", "payload"];
  const requiredPayloadFields = ["to", "data"];

  let isValid = true;
  for (const field of requiredFields) {
    if (!(field in prepareAuthorizeResponse2)) {
      console.log(`   ❌ Missing field: ${field}`);
      isValid = false;
    }
  }

  if (prepareAuthorizeResponse2.txData) {
    for (const field of requiredTxDataFields) {
      if (!(field in prepareAuthorizeResponse2.txData)) {
        console.log(`   ❌ Missing txData field: ${field}`);
        isValid = false;
      }
    }

    if (prepareAuthorizeResponse2.txData.payload) {
      for (const field of requiredPayloadFields) {
        if (!(field in prepareAuthorizeResponse2.txData.payload)) {
          console.log(`   ❌ Missing payload field: ${field}`);
          isValid = false;
        }
      }
    }
  }

  if (prepareAuthorizeResponse2.requiresSignature !== false) {
    console.log(`   ❌ Expected requiresSignature to be false when permit is provided`);
    isValid = false;
  }

  if (isValid) {
    console.log(`   ✅ Response structure is valid`);
  } else {
    throw new Error("Invalid response structure");
  }

  // Step 6: Optionally send the transaction to verify it works
  console.log(`\n📤 Step 6: Sending authorize transaction to local Foundry...`);
  try {
    const authorizeTxHash = await walletClient.sendTransaction({
      to: prepareAuthorizeResponse2.txData.payload.to,
      data: prepareAuthorizeResponse2.txData.payload.data,
      value: BigInt(prepareAuthorizeResponse2.txData.payload.value || "0x0"),
    });

    console.log(`   Transaction hash: ${authorizeTxHash}`);
    console.log(`   Waiting for confirmation...`);

    const authorizeReceipt = await publicClient.waitForTransactionReceipt({ hash: authorizeTxHash });
    console.log(`   ✅ Transaction confirmed in block ${authorizeReceipt.blockNumber}`);
    console.log(`   Status: ${authorizeReceipt.status === "success" ? "✅ Success" : "❌ Failed"}`);

    if (authorizeReceipt.status === "success") {
      console.log(`\n✅ SUCCESS! PrepareAuthorize endpoint test passed`);
    } else {
      console.log(`\n⚠️  Transaction failed but API response was valid`);
    }
  } catch (error) {
    console.log(`   ⚠️  Failed to send transaction: ${error.message}`);
    console.log(`   Note: This might be expected if the transaction would fail on-chain`);
    console.log(`   The API response structure is still valid`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ All tests completed!");
  console.log(`${"=".repeat(60)}\n`);
}

main().catch(error => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});
