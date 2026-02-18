/**
 * E2E test: get attachment cost → quote (buy tokens) → execute → verify balance →
 * prepareAuthorize → execute → verify → get attachment and save file.
 *
 * Requires: yarn chain, yarn deploy, yarn start (API at localhost:3000, RPC at localhost:8545).
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, formatUnits, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const PRIVATE_KEY = "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6";
const TOKEN_ID = 1;
const CAMPAIGN_ID = "0x8c90f15f70418eecaa12b6674e201cb6bb3ea90d";
const ATTACHMENT_ID = 0;
const MOCK_USD_ADDRESS = "0x0efdDbB35e9BBc8c762E5B4a0f627210b6c9A721";
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const API_BASE_URL = "http://localhost:3000";
const RPC_URL = "http://localhost:8545";

const ERC20_ABI = [
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "mint", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
];

const MAX_UINT160 = 2n ** 160n - 1n;
const TX_SETTLE_DELAY_MS = 2000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logReceipt(name, receipt) {
  console.log(`   Tx result: status=${receipt.status}, block=${receipt.blockNumber}, gasUsed=${receipt.gasUsed}`);
}

async function main() {
  console.log("🚀 IP Attachment E2E Test: quote → buy → authorize → get attachment\n");

  const account = privateKeyToAccount(PRIVATE_KEY);
  const userAddress = account.address;
  console.log(`📝 User Address: ${userAddress}`);

  const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: foundry, transport: http(RPC_URL) });

  // Clear code at test account so Permit2 uses ecrecover (EOA)
  const code = await publicClient.getCode({ address: userAddress });
  if (code && code !== "0x") {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "anvil_setCode", params: [userAddress, "0x"], id: 1 }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`anvil_setCode: ${data.error.message}`);
    console.log(`   ✅ Cleared code at ${userAddress}`);
  }

  const licenseAddress = CAMPAIGN_ID;
  const attachmentUrl = `${API_BASE_URL}/api/ip/${TOKEN_ID}/${CAMPAIGN_ID}/${ATTACHMENT_ID}`;
  const quoteUrl = `${API_BASE_URL}/api/ip/${TOKEN_ID}/${CAMPAIGN_ID}/quote`;
  const prepareAuthorizeUrl = `${API_BASE_URL}/api/ip/${TOKEN_ID}/${CAMPAIGN_ID}/prepareAuthorize`;

  // ── 0) Get amount of tokens needed for attachment ────────────────────────
  console.log("\n📌 Step 0: Get amount of tokens needed for attachment (GET attachment quote)");
  const quoteAmountRes = await fetch(attachmentUrl, { method: "GET" });
  if (!quoteAmountRes.ok) {
    const err = await quoteAmountRes.text();
    throw new Error(`Attachment quote failed ${quoteAmountRes.status}: ${err}`);
  }
  const { amount: attachmentAmount } = await quoteAmountRes.json();
  if (attachmentAmount == null || attachmentAmount < 1) {
    throw new Error(`Invalid attachment amount: ${attachmentAmount}`);
  }
  console.log(`   Amount needed: ${attachmentAmount} tokens`);

  // Initial campaign token balance
  let balanceBeforeBuy = await publicClient.readContract({
    address: licenseAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress],
  });
  console.log(`   Initial license balance: ${formatUnits(balanceBeforeBuy, 18)}`);

  // ── 1) Quote API: get executable tx to buy tokens ────────────────────────
  console.log("\n📌 Step 1: Quote API – get permit message for buying tokens");
  const quote1Raw = await fetch(quoteUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: attachmentAmount, userAddress: userAddress }),
  });
  const quote1 = await quote1Raw.json();
  if (quote1.error) throw new Error(`Quote API: ${quote1.error}`);
  if (!quote1.permitMessage) throw new Error("Quote API: no permitMessage");
  console.log(`   Amount in: ${quote1.amountIn}, amount out: ${quote1.amountOut}`);

  const amountInRaw = parseUnits(quote1.amountIn.toString(), 18);

  // Mint USD if needed
  const usdBalance = await publicClient.readContract({
    address: MOCK_USD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress],
  });
  if (usdBalance < amountInRaw) {
    const mintHash = await walletClient.writeContract({
      address: MOCK_USD_ADDRESS,
      abi: ERC20_ABI,
      functionName: "mint",
      args: [userAddress, amountInRaw * 2n],
    });
    console.log(`   Mint tx hash: ${mintHash}`);
    const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
    logReceipt("mint USD", mintReceipt);
    await delay(TX_SETTLE_DELAY_MS);
    console.log(`   Minted mock USD`);
  }

  const allowanceUsd = await publicClient.readContract({
    address: MOCK_USD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress, PERMIT2_ADDRESS],
  });
  if (allowanceUsd < amountInRaw) {
    const approveHash = await walletClient.writeContract({
      address: MOCK_USD_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [PERMIT2_ADDRESS, MAX_UINT160],
    });
    console.log(`   Approve USD tx hash: ${approveHash}`);
    const approveUsdReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
    logReceipt("approve USD", approveUsdReceipt);
    await delay(TX_SETTLE_DELAY_MS);
    console.log(`   Approved Permit2 for USD`);
  }

  const permitMessage = quote1.permitMessage;
  const buySignature = await walletClient.signTypedData({
    domain: permitMessage.domain,
    types: permitMessage.types,
    primaryType: permitMessage.primaryType,
    message: permitMessage.message,
  });

  const quote2Raw = await fetch(quoteUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: attachmentAmount,
      userAddress: userAddress,
      permit: { message: permitMessage, signature: buySignature },
    }),
  });
  const quote2 = await quote2Raw.json();
  if (quote2.error) throw new Error(`Quote API (with permit): ${quote2.error}`);
  if (!quote2.txData?.payload) throw new Error("Quote API: no txData.payload");

  // ── 2) Execute buy tx ───────────────────────────────────────────────────
  console.log("\n📌 Step 2: Execute buy transaction");
  const buyTxHash = await walletClient.sendTransaction({
    to: quote2.txData.payload.to,
    data: quote2.txData.payload.data,
    value: BigInt(quote2.txData.payload.value ?? "0"),
  });
  console.log(`   Tx hash: ${buyTxHash}`);
  const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyTxHash });
  logReceipt("buy", buyReceipt);
  await delay(TX_SETTLE_DELAY_MS);

  // ── 3) Verify balance changed ───────────────────────────────────────────
  console.log("\n📌 Step 3: Verify balance changed after buy");
  const balanceAfterBuy = await publicClient.readContract({
    address: licenseAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress],
  });
  const bought = balanceAfterBuy - balanceBeforeBuy;
  const expectedBuy = parseUnits(attachmentAmount.toString(), 18);
  if (bought < expectedBuy) {
    throw new Error(`Balance did not increase enough: got +${formatUnits(bought, 18)}, expected >= ${attachmentAmount}`);
  }
  console.log(`   License balance after buy: ${formatUnits(balanceAfterBuy, 18)} (+${formatUnits(bought, 18)})`);

  // ── 4) Prepare authorize tx ─────────────────────────────────────────────
  console.log("\n📌 Step 4: Prepare authorize – get permit + paymentInfo");
  const pa1Raw = await fetch(prepareAuthorizeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: attachmentAmount, userAddress: userAddress }),
  });
  const pa1 = await pa1Raw.json();
  if (pa1Raw.status !== 200 || pa1.error) {
    throw new Error(`prepareAuthorize: ${pa1.error || "non-200"}`);
  }
  if (!pa1.permitMessage || !pa1.paymentInfo) {
    throw new Error("prepareAuthorize: missing permitMessage or paymentInfo");
  }

  const licenseAllowance = await publicClient.readContract({
    address: licenseAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress, PERMIT2_ADDRESS],
  });
  const authorizeAmountRaw = parseUnits(attachmentAmount.toString(), 18);
  if (licenseAllowance < authorizeAmountRaw) {
    const approveHash = await walletClient.writeContract({
      address: licenseAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [PERMIT2_ADDRESS, MAX_UINT160],
    });
    console.log(`   Approve tx hash: ${approveHash}`);
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
    logReceipt("approve license", approveReceipt);
    await delay(TX_SETTLE_DELAY_MS);
    console.log(`   Approved Permit2 for license tokens`);
  }

  const authPermitMessage = pa1.permitMessage;
  const authSignature = await walletClient.signTypedData({
    domain: authPermitMessage.domain,
    types: authPermitMessage.types,
    primaryType: authPermitMessage.primaryType,
    message: authPermitMessage.message,
  });

  const pa2Raw = await fetch(prepareAuthorizeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: attachmentAmount,
      userAddress: userAddress,
      permit: { message: authPermitMessage, signature: authSignature },
      paymentInfo: pa1.paymentInfo,
    }),
  });
  const pa2 = await pa2Raw.json();
  if (pa2.error) throw new Error(`prepareAuthorize (with permit): ${pa2.error}`);
  if (!pa2.txData?.payload) throw new Error("prepareAuthorize: no txData.payload");

  // ── 5) Execute authorize tx, verify ─────────────────────────────────────
  console.log("\n📌 Step 5: Execute authorize transaction");
  const authTxHash = await walletClient.sendTransaction({
    to: pa2.txData.payload.to,
    data: pa2.txData.payload.data,
    value: BigInt(pa2.txData.payload.value ?? "0"),
  });
  console.log(`   Tx hash: ${authTxHash}`);
  const authReceipt = await publicClient.waitForTransactionReceipt({ hash: authTxHash });
  logReceipt("authorize", authReceipt);
  if (authReceipt.status !== "success") {
    throw new Error(`Authorize tx failed: ${authTxHash}`);
  }
  await delay(TX_SETTLE_DELAY_MS);

  // ── 6) Get attachment and save file ─────────────────────────────────────
  console.log("\n📌 Step 6: Get attachment (POST with paymentInfo, then SIWE + Authorization)");
  const bodyWithPayment = { address: userAddress, paymentInfo: pa1.paymentInfo };

  // First POST: no Authorization → expect 401 with SIWE challenge
  const challengeRes = await fetch(attachmentUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyWithPayment),
  });
  if (challengeRes.status !== 401) {
    const text = await challengeRes.text();
    throw new Error(`Expected 401 SIWE challenge, got ${challengeRes.status}: ${text.slice(0, 300)}`);
  }
  const challengeJson = await challengeRes.json();
  if (!challengeJson.message && !challengeJson.siwe) {
    throw new Error("401 response missing SIWE message");
  }
  if (!challengeJson.opaqueToken) {
    throw new Error("401 response missing opaqueToken");
  }
  const siweMessageBody = typeof challengeJson.siwe === "string" ? challengeJson.siwe : challengeJson.message;
  const opaqueToken = challengeJson.opaqueToken;

  const siweSignature = await walletClient.signMessage({ message: siweMessageBody });
  const authPayload = JSON.stringify({ message: siweMessageBody, signature: siweSignature, opaqueToken });
  const authToken = Buffer.from(authPayload, "utf-8").toString("base64");

  const attachmentRes = await fetch(attachmentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(bodyWithPayment),
  });

  if (!attachmentRes.ok) {
    const errText = await attachmentRes.text();
    throw new Error(`Get attachment failed ${attachmentRes.status}: ${errText}`);
  }

  const contentType = attachmentRes.headers.get("Content-Type") ?? "";
  const contentDisposition = attachmentRes.headers.get("Content-Disposition") ?? "";
  const buffer = Buffer.from(await attachmentRes.arrayBuffer());

  let filename = `attachment-${ATTACHMENT_ID}`;
  const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
  if (match) filename = match[1];
  const ext = contentType.includes("json") ? ".json" : contentType.includes("png") ? ".png" : contentType.includes("jpeg") || contentType.includes("jpg") ? ".jpg" : contentType.includes("pdf") ? ".pdf" : contentType.includes("octet-stream") ? ".bin" : "";
  if (ext && !filename.includes(".")) filename += ext;

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outPath = join(scriptDir, filename);
  writeFileSync(outPath, buffer);
  console.log(`   Content-Type: ${contentType}`);
  console.log(`   Saved ${buffer.length} bytes to: ${outPath}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ E2E test passed: quote → buy → authorize → get attachment");
  console.log("=".repeat(60) + "\n");
}

main().catch(err => {
  console.error("\n❌ Test failed:", err);
  process.exit(1);
});
