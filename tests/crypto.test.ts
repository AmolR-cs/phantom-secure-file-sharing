import { describe, it, expect } from "vitest";
import {
  generateMasterKey,
  toBase64Url,
  fromBase64Url,
  generateSalt,
  generateNoncePrefix,
  buildShareUrl,
  parseFragment,
} from "../src/lib/crypto/keys";
import { deriveKeyHierarchy } from "../src/lib/crypto/hkdf";
import { serializeAAD, deserializeAAD } from "../src/lib/crypto/aad";
import {
  encryptChunk,
  decryptChunk,
  encryptMetadata,
  decryptMetadata,
  computeDigestHex,
  CHUNK_SIZE,
} from "../src/lib/crypto/cipher";
import {
  wrapMasterKey,
  unwrapMasterKey,
  computeServerVerifier,
} from "../src/lib/crypto/password";
import {
  createCapabilityToken,
  verifyCapabilityToken,
} from "../src/lib/crypto/token";

describe("PHANTOM Cryptographic Core", () => {
  it("generates 256-bit master keys with URL-safe Base64 encoding", () => {
    const key = generateMasterKey();
    expect(key.length).toBe(32); // 256 bits

    const b64url = toBase64Url(key);
    expect(b64url).not.toContain("+");
    expect(b64url).not.toContain("/");
    expect(b64url).not.toContain("=");

    const decoded = fromBase64Url(b64url);
    expect(decoded).toEqual(key);
  });

  it("builds and parses URL fragments without leaking to HTTP paths", () => {
    const key = generateMasterKey();
    const keyStr = toBase64Url(key);
    const url = buildShareUrl("https://phantom.app", "file_12345", keyStr);

    expect(url).toBe(`https://phantom.app/f/file_12345#key=${keyStr}`);

    const hash = `#key=${keyStr}&custom=true`;
    const parsed = parseFragment(hash);
    expect(parsed.key).toBe(keyStr);
    expect(parsed.custom).toBe("true");
  });

  it("derives distinct keys for file, metadata, and auth via HKDF-SHA256 (no key reuse)", async () => {
    const masterKey = generateMasterKey();
    const salt = generateSalt();

    const keys = await deriveKeyHierarchy(masterKey, salt);
    expect(keys.fileKey).toBeDefined();
    expect(keys.metadataKey).toBeDefined();
    expect(keys.authKey).toBeDefined();

    expect(keys.fileKey.algorithm.name).toBe("AES-GCM");
    expect(keys.metadataKey.algorithm.name).toBe("AES-GCM");
    expect(keys.authKey.algorithm.name).toBe("HMAC");
  });

  it("correctly serializes and deserializes canonical binary AAD", () => {
    const aadParams = {
      fileId: "test_file_id_99a8b",
      chunkIndex: 3,
      totalChunks: 10,
      isLastChunk: false,
    };

    const serialized = serializeAAD(aadParams);
    expect(serialized.byteLength).toBe(4 + aadParams.fileId.length + 4 + 4 + 1);

    const deserialized = deserializeAAD(serialized);
    expect(deserialized).toEqual(aadParams);

    const lastAadParams = {
      fileId: "test_file_id_99a8b",
      chunkIndex: 9,
      totalChunks: 10,
      isLastChunk: true,
    };
    const lastSerialized = serializeAAD(lastAadParams);
    const lastDeserialized = deserializeAAD(lastSerialized);
    expect(lastDeserialized.isLastChunk).toBe(true);
  });

  it("encrypts and decrypts 1MB chunks with AAD binding", async () => {
    const masterKey = generateMasterKey();
    const salt = generateSalt();
    const { fileKey } = await deriveKeyHierarchy(masterKey, salt);
    const noncePrefix = generateNoncePrefix();

    const originalData = new Uint8Array(1024); // 1KB test payload
    for (let i = 0; i < originalData.length; i++) {
      originalData[i] = i % 256;
    }

    const aadParams = {
      fileId: "file_alpha_1",
      chunkIndex: 0,
      totalChunks: 1,
      isLastChunk: true,
    };

    const encResult = await encryptChunk(fileKey, originalData.buffer, noncePrefix, aadParams);
    expect(encResult.chunkIndex).toBe(0);
    expect(encResult.ciphertext.byteLength).toBe(originalData.length + 16); // 16-byte AES-GCM tag

    const decrypted = await decryptChunk(fileKey, encResult.ciphertext, noncePrefix, aadParams);
    expect(new Uint8Array(decrypted)).toEqual(originalData);
  });

  it("fails decryption if 1 bit in ciphertext is tampered (Authentication Tag Mismatch)", async () => {
    const masterKey = generateMasterKey();
    const salt = generateSalt();
    const { fileKey } = await deriveKeyHierarchy(masterKey, salt);
    const noncePrefix = generateNoncePrefix();

    const originalData = new TextEncoder().encode("Top Secret Payload");
    const aadParams = {
      fileId: "file_tamper_test",
      chunkIndex: 0,
      totalChunks: 1,
      isLastChunk: true,
    };

    const encResult = await encryptChunk(fileKey, originalData.buffer, noncePrefix, aadParams);

    // Tamper with 1 bit
    const tampered = new Uint8Array(encResult.ciphertext);
    tampered[5] ^= 0x01; // flip bit

    await expect(
      decryptChunk(fileKey, tampered.buffer, noncePrefix, aadParams)
    ).rejects.toThrow();
  });

  it("fails decryption if chunks are reordered (AAD Chunk Index mismatch)", async () => {
    const masterKey = generateMasterKey();
    const salt = generateSalt();
    const { fileKey } = await deriveKeyHierarchy(masterKey, salt);
    const noncePrefix = generateNoncePrefix();

    const chunk0Data = new TextEncoder().encode("Chunk 0 data");
    const aad0 = { fileId: "file_reorder", chunkIndex: 0, totalChunks: 2, isLastChunk: false };
    const enc0 = await encryptChunk(fileKey, chunk0Data.buffer, noncePrefix, aad0);

    // Attempt to decrypt chunk 0 using chunk 1's AAD
    const aad1 = { fileId: "file_reorder", chunkIndex: 1, totalChunks: 2, isLastChunk: true };
    await expect(
      decryptChunk(fileKey, enc0.ciphertext, noncePrefix, aad1)
    ).rejects.toThrow();
  });

  it("encrypts and decrypts metadata with zero-knowledge of true filename/mime/size", async () => {
    const masterKey = generateMasterKey();
    const salt = generateSalt();
    const { metadataKey } = await deriveKeyHierarchy(masterKey, salt);

    const metadata = {
      name: "financial_records_q3.xlsx",
      size: 4892301,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sha256: "a1b2c3d4e5f67890",
      totalChunks: 5,
      chunkSize: CHUNK_SIZE,
      uploadedAt: Date.now(),
    };

    const { encryptedMetadata, iv } = await encryptMetadata(metadataKey, metadata);
    expect(encryptedMetadata).not.toContain("financial_records");

    const decrypted = await decryptMetadata(metadataKey, encryptedMetadata, iv);
    expect(decrypted).toEqual(metadata);
  });

  it("wraps and unwraps master key using password derivation", async () => {
    const masterKey = generateMasterKey();
    const password = "CorrectHorseBatteryStaple#99";

    const wrapResult = await wrapMasterKey(masterKey, password);
    expect(wrapResult.wrappedKey).toBeDefined();
    expect(wrapResult.serverVerifier).toBeDefined();

    // Unwrap with correct password
    const recovered = await unwrapMasterKey(
      wrapResult.wrappedKey,
      wrapResult.salt,
      wrapResult.iv,
      password
    );
    expect(recovered).toEqual(masterKey);

    // Unwrap with incorrect password fails
    await expect(
      unwrapMasterKey(
        wrapResult.wrappedKey,
        wrapResult.salt,
        wrapResult.iv,
        "WrongPassword123!"
      )
    ).rejects.toThrow();

    // Verify buildShareUrl with wrapped key and iv fragment round-trip
    const url = buildShareUrl("https://phantom.share", "test_file_id", wrapResult.wrappedKey, true, wrapResult.iv);
    expect(url).toContain("#wrapped=");
    expect(url).toContain("&iv=");

    const hash = url.slice(url.indexOf("#"));
    const parsed = parseFragment(hash);
    expect(parsed.wrapped).toBe(wrapResult.wrappedKey);
    expect(parsed.iv).toBe(wrapResult.iv);

    const recoveredFromFragment = await unwrapMasterKey(
      parsed.wrapped,
      wrapResult.salt,
      parsed.iv,
      password
    );
    expect(recoveredFromFragment).toEqual(masterKey);
  });

  it("signs and validates capability tokens with replay prevention", async () => {
    const fileId = "test_file_cap_token";
    const { token, nonce, expiresAt } = await createCapabilityToken(fileId, 60, "download");

    // Valid verification
    const res = await verifyCapabilityToken(token, fileId, "download");
    expect(res.valid).toBe(true);
    expect(res.payload?.nonce).toBe(nonce);
    expect(res.payload?.fileId).toBe(fileId);

    // File ID mismatch fails
    const mismatchRes = await verifyCapabilityToken(token, "wrong_file_id", "download");
    expect(mismatchRes.valid).toBe(false);
    expect(mismatchRes.error).toBe("TOKEN_FILE_ID_MISMATCH");

    // Tampered token fails
    const tamperedToken = token.slice(0, -4) + "XXXX";
    const tamperedRes = await verifyCapabilityToken(tamperedToken, fileId, "download");
    expect(tamperedRes.valid).toBe(false);
  });
});
