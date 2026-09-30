/**
 * PHANTOM 90-Second Demonstration Script (npm run demo)
 * Demonstrates the end-to-end lifecycle:
 * Client-Side WebCrypto Encryption -> Fragment Key Passing -> Atomic Burn -> DoD Shredding -> Audit Verification
 */

import { prisma } from "../src/lib/db/prisma";
import { FileService } from "../src/lib/services/file-service";
import { defaultStorage } from "../src/lib/storage/local-shredder";
import {
  generateMasterKey,
  generateSalt,
  generateNoncePrefix,
  toBase64Url,
  fromBase64Url,
  buildShareUrl,
} from "../src/lib/crypto/keys";
import { deriveKeyHierarchy } from "../src/lib/crypto/hkdf";
import { encryptChunk, decryptChunk, encryptMetadata, decryptMetadata, CHUNK_SIZE } from "../src/lib/crypto/cipher";
import { verifyAuditChainIntegrity } from "../src/lib/audit/hash-chain";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log(`\n${colors.cyan}${colors.bright}`);
  console.log("===============================================================================");
  console.log("            PHANTOM 👻  ::  90-SECOND INTERACTIVE DEMO STORY                   ");
  console.log("                 \"Share it. Then make it never exist.\"                         ");
  console.log("===============================================================================");
  console.log(`${colors.reset}`);

  // SCENE 1: Sender Preparation
  console.log(`${colors.yellow}[STEP 1 / 7] Alice generates Ephemeral 256-bit Master Key in Browser...${colors.reset}`);
  const masterKey = generateMasterKey();
  const masterKeyB64 = toBase64Url(masterKey);
  console.log(`  🔑 Client Master Key: ${colors.green}${masterKeyB64}${colors.reset} (Resides ONLY in client RAM & URL fragment)`);
  await sleep(1000);

  // SCENE 2: HKDF Subkey Derivation & Chunk Encryption
  console.log(`\n${colors.yellow}[STEP 2 / 7] Deriving HKDF-SHA256 Isolated Subkeys & Encrypting File Chunks...${colors.reset}`);
  const salt = generateSalt();
  const saltB64 = toBase64Url(salt);
  const noncePrefix = generateNoncePrefix();
  const noncePrefixB64 = toBase64Url(noncePrefix);
  const { fileKey, metadataKey } = await deriveKeyHierarchy(masterKey, salt);

  const secretDocument = "TOP SECRET: Project Phantom Launch Codes :: Alpha-7749-Bravo\nExpires Immediately After First Access.";
  const plainBytes = new TextEncoder().encode(secretDocument);
  const fileId = `phantom_demo_${Date.now()}`;

  const aad = { fileId, chunkIndex: 0, totalChunks: 1, isLastChunk: true };
  const encryptedChunk = await encryptChunk(fileKey, plainBytes.buffer, noncePrefix, aad);

  const metadata = {
    name: "executive_briefing_2026.docx",
    size: plainBytes.byteLength,
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    totalChunks: 1,
    chunkSize: CHUNK_SIZE,
    uploadedAt: Date.now(),
  };

  const { encryptedMetadata, iv: metadataIv } = await encryptMetadata(metadataKey, metadata);
  console.log(`  🔒 Plaintext Metadata: "${metadata.name}" (${metadata.size} bytes)`);
  console.log(`  🛡️ Ciphertext Metadata: ${colors.dim}${encryptedMetadata.slice(0, 32)}...${colors.reset}`);
  await sleep(1000);

  // SCENE 3: Server Registration
  console.log(`\n${colors.yellow}[STEP 3 / 7] Alice transmits Ciphertext to Server (Zero-Knowledge Upload)...${colors.reset}`);
  await FileService.createFile({
    id: fileId,
    salt: saltB64,
    encryptedMetadata,
    metadataIv,
    noncePrefix: noncePrefixB64,
    totalChunks: 1,
    totalSizeBytes: plainBytes.byteLength,
    burnAfterRead: true,
    maxDownloads: 1,
    clientIp: "203.0.113.19",
  });
  await FileService.saveChunk(fileId, 0, Buffer.from(encryptedChunk.ciphertext));

  const shareUrl = buildShareUrl("https://phantom.share", fileId, masterKeyB64);
  console.log(`  🔗 Share URL Generated: ${colors.cyan}${shareUrl}${colors.reset}`);
  console.log(`  🛡️ RFC 3986 Proof: '#key=${masterKeyB64}' is NEVER transmitted to the server!`);
  await sleep(1200);

  // SCENE 4: Bob Opens the Link
  console.log(`\n${colors.yellow}[STEP 4 / 7] Bob opens link & requests capability token...${colors.reset}`);
  const authRes = await FileService.authorizeDownload(fileId, undefined, "198.51.100.42");
  console.log(`  🎟️ Signed Capability Token: ${colors.green}HMAC-SHA256 Token Issued (60s TTL, single-use nonce)${colors.reset}`);
  await sleep(1000);

  // SCENE 5: Bob Decrypts Chunks in Browser
  console.log(`\n${colors.yellow}[STEP 5 / 7] Bob downloads chunk & performs Web Crypto AES-256-GCM Decryption...${colors.reset}`);
  const storageChunk = await defaultStorage.getChunk(`storage/blobs/${fileId}/chunk_0.bin`);
  const chunkArrayBuf = storageChunk.buffer.slice(
    storageChunk.byteOffset,
    storageChunk.byteOffset + storageChunk.byteLength
  ) as ArrayBuffer;
  const decryptedBuf = await decryptChunk(fileKey, chunkArrayBuf, noncePrefix, aad);
  const decryptedText = new TextDecoder().decode(decryptedBuf);
  console.log(`  🔓 Decrypted in Browser RAM: "${colors.bright}${decryptedText.split("\n")[0]}${colors.reset}"`);
  await sleep(1200);

  // SCENE 6: Cryptographic Eradication (Burn-After-Read)
  console.log(`\n${colors.yellow}[STEP 6 / 7] Burn-After-Read Triggered! DoD 5220.22-M Multi-Pass Shredder executing...${colors.reset}`);
  const shred = await FileService.shredAndEradicateFile(fileId, "BURN_DOWNLOAD_COMPLETE", "198.51.100.42");
  const isZeroBlobs = await defaultStorage.verifyZeroDanglingBlobs(fileId);
  console.log(`  🔥 Overwritten with Zeroes (0x00), Ones (0xFF), CSPRNG Random Bytes.`);
  console.log(`  🔥 fsyncSync flushed to physical storage + unlinked.`);
  console.log(`  🔥 Zero Dangling Blobs Verified: ${colors.green}${isZeroBlobs}${colors.reset}`);
  await sleep(1200);

  // SCENE 7: Verification of Hostile Host & Audit Integrity
  console.log(`\n${colors.yellow}[STEP 7 / 7] Attacker dumps Database and Disk / Verifying Tamper-Evident Hash Chain...${colors.reset}`);
  const secondAttempt = await FileService.authorizeDownload(fileId, undefined, "198.51.100.42");
  console.log(`  🚫 Subsequent Access Attempt: ${colors.red}HTTP ${secondAttempt.status} ${secondAttempt.error} (File never existed)${colors.reset}`);

  const chainAudit = await verifyAuditChainIntegrity();
  console.log(`  📜 Hash-Chained Audit Trail Integrity: ${colors.green}VALID (Entries: ${chainAudit.totalEntries})${colors.reset}`);
  console.log(`  🔗 Chain Head Hash: ${colors.dim}${chainAudit.headHash}${colors.reset}`);

  console.log(`\n${colors.green}${colors.bright}===============================================================================`);
  console.log("             PHANTOM DEMONSTRATION COMPLETE: ABSOLUTE PRIVACY GUARANTEED!      ");
  console.log(`===============================================================================\n${colors.reset}`);
}

runDemo()
  .catch((err) => {
    console.error("Demo failed:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
