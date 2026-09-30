/**
 * Key Generation and Encoding Utilities
 * Compatible with Browser and Node.js Web Crypto API
 */

export function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error("Web Crypto API (subtle) is not available in this environment.");
}

export function getRandomValues(arr: Uint8Array): Uint8Array {
  if (typeof window !== "undefined" && window.crypto) {
    return window.crypto.getRandomValues(arr);
  }
  if (typeof globalThis !== "undefined" && globalThis.crypto) {
    return globalThis.crypto.getRandomValues(arr);
  }
  throw new Error("crypto.getRandomValues is not available in this environment.");
}

/**
 * Generate 256-bit (32 bytes) cryptographically secure random master key
 */
export function generateMasterKey(): Uint8Array {
  return getRandomValues(new Uint8Array(32));
}

/**
 * Generate cryptographic salt (default 16 bytes)
 */
export function generateSalt(bytes = 16): Uint8Array {
  return getRandomValues(new Uint8Array(bytes));
}

/**
 * Generate 8-byte random prefix for chunk nonces
 */
export function generateNoncePrefix(): Uint8Array {
  return getRandomValues(new Uint8Array(8));
}

/**
 * Encode Uint8Array or ArrayBuffer to URL-safe Base64 (RFC 4648 §5, unpadded)
 */
export function toBase64Url(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === "function" 
    ? btoa(binary) 
    : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode URL-safe Base64 string to Uint8Array
 */
export function fromBase64Url(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = typeof atob === "function"
    ? atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parse URL fragment into key/value pairs
 * E.g. "#key=abc&wrapped=0" -> { key: "abc", wrapped: "0" }
 */
export function parseFragment(hash: string): Record<string, string> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params: Record<string, string> = {};
  const pairs = clean.split("&");
  for (const pair of pairs) {
    const [k, v] = pair.split("=");
    if (k && v !== undefined) {
      params[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  return params;
}

/**
 * Build shareable URL with fragment anchor (never sent to server)
 */
export function buildShareUrl(
  baseUrl: string,
  fileId: string,
  keyParam: string,
  isWrapped = false
): string {
  const fragmentKey = isWrapped ? "wrapped" : "key";
  const url = baseUrl.replace(/\/+$/, "");
  return `${url}/f/${fileId}#${fragmentKey}=${keyParam}`;
}
