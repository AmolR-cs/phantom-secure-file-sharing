/**
 * PHANTOM Core Cryptographic Types
 */

export interface EncryptedMetadataPayload {
  name: string;
  size: number;
  type: string;
  sha256: string;
  totalChunks: number;
  chunkSize: number;
  uploadedAt: number;
}

export interface ChunkAADParams {
  fileId: string; // 128-bit hex string or UUID
  chunkIndex: number;
  totalChunks: number;
  isLastChunk: boolean;
}

export interface EncryptedChunkResult {
  chunkIndex: number;
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
}

export interface DecryptedChunkResult {
  chunkIndex: number;
  plaintext: ArrayBuffer;
}

export interface DerivedKeySet {
  fileKey: CryptoKey;
  metadataKey: CryptoKey;
  authKey: CryptoKey;
}

export interface PasswordWrapResult {
  wrappedKey: string; // Base64URL ciphertext of MasterKey
  salt: string; // Base64URL salt for PBKDF2/Argon2
  iv: string; // Base64URL IV for AES-GCM wrapping
  serverVerifier: string; // Base64URL hash for server auth check
}

export interface CapabilityTokenPayload {
  fileId: string;
  expiresAt: number;
  nonce: string;
  scope: "download" | "burn";
}
