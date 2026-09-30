import { getSubtleCrypto, getRandomValues, toBase64Url, fromBase64Url } from "./keys";
import { serializeAAD } from "./aad";
import { ChunkAADParams, EncryptedChunkResult, EncryptedMetadataPayload } from "./types";

export const CHUNK_SIZE = 1024 * 1024; // 1 MB per chunk

/**
 * Constructs a 96-bit (12 bytes) IV composed of an 8-byte random prefix and a 4-byte big-endian counter
 */
export function constructChunkIV(noncePrefix: Uint8Array, chunkIndex: number): Uint8Array {
  if (noncePrefix.length !== 8) {
    throw new Error("Nonce prefix must be exactly 8 bytes");
  }
  const iv = new Uint8Array(12);
  iv.set(noncePrefix, 0);

  const view = new DataView(iv.buffer, iv.byteOffset, 12);
  view.setUint32(8, chunkIndex, false); // Big-Endian 4-byte counter
  return iv;
}

/**
 * Encrypt a single file chunk using AES-256-GCM with AAD binding
 */
export async function encryptChunk(
  fileKey: CryptoKey,
  chunkBuffer: ArrayBuffer,
  noncePrefix: Uint8Array,
  aadParams: ChunkAADParams
): Promise<EncryptedChunkResult> {
  const subtle = getSubtleCrypto();
  const iv = constructChunkIV(noncePrefix, aadParams.chunkIndex);
  const aad = serializeAAD(aadParams);

  const ciphertext = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      additionalData: aad as BufferSource,
      tagLength: 128, // 128-bit authentication tag
    },
    fileKey,
    chunkBuffer
  );

  return {
    chunkIndex: aadParams.chunkIndex,
    ciphertext,
    iv,
  };
}

/**
 * Decrypt a single file chunk using AES-256-GCM, verifying AAD binding
 */
export async function decryptChunk(
  fileKey: CryptoKey,
  ciphertextBuffer: ArrayBuffer,
  noncePrefix: Uint8Array,
  aadParams: ChunkAADParams
): Promise<ArrayBuffer> {
  const subtle = getSubtleCrypto();
  const iv = constructChunkIV(noncePrefix, aadParams.chunkIndex);
  const aad = serializeAAD(aadParams);

  return subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      additionalData: aad as BufferSource,
      tagLength: 128,
    },
    fileKey,
    ciphertextBuffer
  );
}

/**
 * Encrypt file metadata (filename, actual size, mime type, hash)
 */
export async function encryptMetadata(
  metadataKey: CryptoKey,
  payload: EncryptedMetadataPayload
): Promise<{ encryptedMetadata: string; iv: string }> {
  const subtle = getSubtleCrypto();
  const iv = getRandomValues(new Uint8Array(12));
  const rawBytes = new TextEncoder().encode(JSON.stringify(payload));

  const ciphertext = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      tagLength: 128,
    },
    metadataKey,
    rawBytes as BufferSource
  );

  return {
    encryptedMetadata: toBase64Url(ciphertext),
    iv: toBase64Url(iv),
  };
}

/**
 * Decrypt file metadata
 */
export async function decryptMetadata(
  metadataKey: CryptoKey,
  encryptedMetadataBase64: string,
  ivBase64: string
): Promise<EncryptedMetadataPayload> {
  const subtle = getSubtleCrypto();
  const ciphertext = fromBase64Url(encryptedMetadataBase64);
  const iv = fromBase64Url(ivBase64);

  const decryptedBytes = await subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      tagLength: 128,
    },
    metadataKey,
    ciphertext as BufferSource
  );

  const jsonStr = new TextDecoder().decode(decryptedBytes);
  return JSON.parse(jsonStr) as EncryptedMetadataPayload;
}

/**
 * Compute SHA-256 hex digest of an ArrayBuffer
 */
export async function computeDigestHex(buffer: ArrayBuffer): Promise<string> {
  const subtle = getSubtleCrypto();
  const hash = await subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
