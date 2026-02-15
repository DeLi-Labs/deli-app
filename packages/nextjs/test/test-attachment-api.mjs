import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const PRIVATE_KEY = "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6";
const TOKEN_ID = 1;
const CAMPAIGN_ID = "0xeac967a7af2dd37b630f3814cb631fe8fca050a9";
const ATTACHMENT_ID = 0;
const API_BASE_URL = "http://localhost:3000";
const RPC_URL = "http://localhost:8545";

const attachmentUrl = `${API_BASE_URL}/api/ip/${TOKEN_ID}/${CAMPAIGN_ID}/${ATTACHMENT_ID}`;

async function main() {
  console.log("🚀 Starting Get Attachment API Test\n");

  const account = privateKeyToAccount(PRIVATE_KEY);
  const userAddress = account.address;
  console.log(`📝 User Address: ${userAddress}`);
  console.log(`   Attachment URL: ${attachmentUrl}\n`);

  const walletClient = createWalletClient({
    account,
    chain: foundry,
    transport: http(RPC_URL),
  });

  // ============================================
  // Test 1: No accountAddress → expect error
  // ============================================
  console.log(`${"=".repeat(60)}`);
  console.log("🧪 Test 1: GET without accountAddress (expect error)");
  console.log(`${"=".repeat(60)}\n`);

  const noAccountRes = await fetch(attachmentUrl, { method: "GET" });
  const noAccountBody = await noAccountRes.text();
  let noAccountJson;
  try {
    noAccountJson = JSON.parse(noAccountBody);
  } catch {
    noAccountJson = null;
  }

  console.log(`   Response status: ${noAccountRes.status}`);
  if (noAccountJson?.error) {
    console.log(`   Error: ${noAccountJson.error}`);
  } else if (noAccountBody) {
    console.log(`   Body: ${noAccountBody.slice(0, 200)}${noAccountBody.length > 200 ? "..." : ""}`);
  }

  if (noAccountRes.status === 401 || (noAccountRes.status >= 400 && (noAccountJson?.error || noAccountBody))) {
    console.log(`   ✅ Correctly rejected (no accountAddress)\n`);
  } else {
    throw new Error(`Expected error response without accountAddress, got ${noAccountRes.status}`);
  }

  // ============================================
  // Test 2: With accountAddress, no Authorization → 401 with SIWE challenge + opaqueToken
  // ============================================
  console.log(`${"=".repeat(60)}`);
  console.log("🧪 Test 2: GET with accountAddress, no Authorization (expect 401 + SIWE challenge + opaqueToken)");
  console.log(`${"=".repeat(60)}\n`);

  const siweChallengeRes = await fetch(`${attachmentUrl}?accountAddress=${encodeURIComponent(userAddress)}`, {
    method: "GET",
  });
  const siweChallengeText = await siweChallengeRes.text();
  let siweChallengeJson;
  try {
    siweChallengeJson = JSON.parse(siweChallengeText);
  } catch {
    throw new Error(`Expected JSON 401 body, got: ${siweChallengeText.slice(0, 200)}`);
  }

  console.log(`   Response status: ${siweChallengeRes.status}`);
  if (siweChallengeRes.status !== 401) {
    throw new Error(`Expected 401 with SIWE challenge, got ${siweChallengeRes.status}: ${siweChallengeText}`);
  }
  if (!siweChallengeJson.error || !siweChallengeJson.message) {
    throw new Error(`Expected 401 body with error and message, got: ${JSON.stringify(siweChallengeJson)}`);
  }
  if (!siweChallengeJson.opaqueToken) {
    throw new Error("Expected 401 body to contain opaqueToken");
  }
  if (siweChallengeJson.siwe) {
    console.log(
      `   siwe: domain=${siweChallengeJson.siwe.domain}, resourceId=${siweChallengeJson.siwe.resourceId ? "present" : "absent"}`,
    );
  }

  const siweMessageBody = siweChallengeJson.message;
  const { opaqueToken } = siweChallengeJson;
  console.log(`   Message length: ${siweMessageBody.length} chars`);
  console.log(`   opaqueToken length: ${opaqueToken.length} chars`);
  if (siweMessageBody.length < 200) {
    console.log(`   Message: ${siweMessageBody}`);
  } else {
    console.log(`   Message (first 300 chars): ${siweMessageBody.slice(0, 300)}...`);
  }

  // The URI should be a lit:session: URI now (not the API endpoint)
  if (!siweMessageBody.includes("lit:session:")) {
    throw new Error("SIWE message should contain lit:session: URI");
  }
  if (!siweMessageBody.toLowerCase().includes(userAddress.toLowerCase())) {
    throw new Error(`SIWE message should contain address ${userAddress}`);
  }
  console.log(`   ✅ Received valid SIWE challenge (401 with lit:session: URI, opaqueToken, and address)\n`);

  // ============================================
  // Test 3: With accountAddress + signed SIWE + opaqueToken → attachment or 404/500
  // ============================================
  console.log(`${"=".repeat(60)}`);
  console.log("🧪 Test 3: GET with accountAddress + Authorization (signed SIWE + opaqueToken)");
  console.log(`${"=".repeat(60)}\n`);

  const signature = await walletClient.signMessage({
    message: siweMessageBody,
  });
  console.log(`   Signed SIWE message`);

  const authPayload = JSON.stringify({
    message: siweMessageBody,
    signature,
    opaqueToken,
  });
  const authToken = Buffer.from(authPayload, "utf-8").toString("base64");
  const authRes = await fetch(`${attachmentUrl}?accountAddress=${encodeURIComponent(userAddress)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  console.log(`   Response status: ${authRes.status}`);
  const contentType = authRes.headers.get("Content-Type");
  const contentDisposition = authRes.headers.get("Content-Disposition");
  console.log(`   Content-Type: ${contentType ?? "(none)"}`);
  console.log(`   Content-Disposition: ${contentDisposition ?? "(none)"}`);

  if (authRes.ok) {
    const body = await authRes.arrayBuffer();
    console.log(`   Body size: ${body.byteLength} bytes`);

    // Determine filename from Content-Disposition or fall back to a default
    let filename = `attachment-${ATTACHMENT_ID}`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
      if (match) filename = match[1];
    }
    // Guess extension from Content-Type
    const ext = contentType?.includes("json")
      ? ".json"
      : contentType?.includes("png")
        ? ".png"
        : contentType?.includes("jpeg") || contentType?.includes("jpg")
          ? ".jpg"
          : contentType?.includes("pdf")
            ? ".pdf"
            : contentType?.includes("octet-stream")
              ? ".bin"
              : "";
    if (ext && !filename.includes(".")) filename += ext;

    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const outPath = join(scriptDir, filename);
    writeFileSync(outPath, Buffer.from(body));
    console.log(`   💾 Saved to: ${outPath}`);

    if (contentDisposition?.includes("attachment")) {
      console.log(`   ✅ Received attachment response`);
    } else {
      console.log(`   ✅ Received 200 (may be attachment or other payload)`);
    }
  } else {
    const errText = await authRes.text();
    let errJson;
    try {
      errJson = JSON.parse(errText);
    } catch {
      errJson = null;
    }
    if (authRes.status === 404 || authRes.status === 500) {
      console.log(`   Response: ${errJson?.error ?? errText}`);
      console.log(`   ⚠️  No attachment for tokenId=${TOKEN_ID} attachmentId=${ATTACHMENT_ID} (expected in dev)`);
    } else {
      throw new Error(`Unexpected error ${authRes.status}: ${errJson?.error ?? errText}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ All Get Attachment API tests completed!");
  console.log(`${"=".repeat(60)}\n`);
}

main().catch(error => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});
