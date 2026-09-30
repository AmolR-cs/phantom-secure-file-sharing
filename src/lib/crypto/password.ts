import { getSubtleCrypto, getRandomValues, toBase64Url, fromBase64Url } from "./keys";
import { PasswordWrapResult } from "./types";

const PBKDF2_ITERATIONS = 100_000; // High work factor PBKDF2 iterations for browser responsiveness and security

/**
 * Derive an AES-GCM key from password and salt using PBKDF2-HMAC-SHA256
 */
export async function derivePasswordKey(
  password: string,
  saltBytes: Uint8Array
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const passwordBytes = new TextEncoder().encode(password);

  const baseKey = await subtle.importKey(
    "raw",
    passwordBytes as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Compute zero-knowledge server verifier from password key
 * Verifier = HMAC-SHA256(PasswordKey, "phantom-server-auth-verifier")
 */
export async function computeServerVerifier(
  password: string,
  saltBytes: Uint8Array
): Promise<string> {
  const subtle = getSubtleCrypto();
  const passwordBytes = new TextEncoder().encode(password);

  const baseKey = await subtle.importKey(
    "raw",
    passwordBytes as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const hmacKey = await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "HMAC",
      hash: "SHA-256",
      length: 256,
    },
    false,
    ["sign"]
  );

  const verifierTag = await subtle.sign(
    "HMAC",
    hmacKey,
    new TextEncoder().encode("phantom-server-auth-verifier") as BufferSource
  );

  return toBase64Url(verifierTag);
}

/**
 * Wrap (encrypt) the 32-byte MasterKey using a password-derived key
 */
export async function wrapMasterKey(
  masterKeyBytes: Uint8Array,
  password: string
): Promise<PasswordWrapResult> {
  const subtle = getSubtleCrypto();
  const salt = getRandomValues(new Uint8Array(16));
  const iv = getRandomValues(new Uint8Array(12));

  const passwordKey = await derivePasswordKey(password, salt);

  const wrappedBuffer = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      tagLength: 128,
    },
    passwordKey,
    masterKeyBytes as BufferSource
  );

  const serverVerifier = await computeServerVerifier(password, salt);

  return {
    wrappedKey: toBase64Url(wrappedBuffer),
    salt: toBase64Url(salt),
    iv: toBase64Url(iv),
    serverVerifier,
  };
}

/**
 * Unwrap (decrypt) the MasterKey using the password
 */
export async function unwrapMasterKey(
  wrappedKeyBase64: string,
  saltBase64: string,
  ivBase64: string,
  password: string
): Promise<Uint8Array> {
  const subtle = getSubtleCrypto();
  const salt = fromBase64Url(saltBase64);
  const iv = fromBase64Url(ivBase64);
  const wrappedBytes = fromBase64Url(wrappedKeyBase64);

  const passwordKey = await derivePasswordKey(password, salt);

  const unwrappedBuffer = await subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      tagLength: 128,
    },
    passwordKey,
    wrappedBytes as BufferSource
  );

  return new Uint8Array(unwrappedBuffer);
}
