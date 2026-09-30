import { getSubtleCrypto } from "./keys";
import { DerivedKeySet } from "./types";

const INFO_FILE = new TextEncoder().encode("phantom-v1-file-encryption");
const INFO_META = new TextEncoder().encode("phantom-v1-metadata-encryption");
const INFO_AUTH = new TextEncoder().encode("phantom-v1-auth-capability");

/**
 * Derive separate, cryptographically isolated keys for file chunks, metadata, and auth tokens
 * using HKDF-SHA256 (RFC 5869)
 */
export async function deriveKeyHierarchy(
  masterKeyBytes: Uint8Array,
  saltBytes: Uint8Array
): Promise<DerivedKeySet> {
  const subtle = getSubtleCrypto();

  // Import raw master key as HKDF Initial Keying Material (IKM)
  const masterKey = await subtle.importKey(
    "raw",
    masterKeyBytes as BufferSource,
    "HKDF",
    false,
    ["deriveKey"]
  );

  // 1. Derive FileKey for AES-256-GCM chunk encryption
  const fileKey = await subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltBytes as BufferSource,
      info: INFO_FILE as BufferSource,
    },
    masterKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );

  // 2. Derive MetadataKey for AES-256-GCM metadata encryption
  const metadataKey = await subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltBytes as BufferSource,
      info: INFO_META as BufferSource,
    },
    masterKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );

  // 3. Derive AuthKey for HMAC-SHA256 capability verification
  const authKey = await subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltBytes as BufferSource,
      info: INFO_AUTH as BufferSource,
    },
    masterKey,
    {
      name: "HMAC",
      hash: "SHA-256",
      length: 256,
    },
    false,
    ["sign", "verify"]
  );

  return { fileKey, metadataKey, authKey };
}
