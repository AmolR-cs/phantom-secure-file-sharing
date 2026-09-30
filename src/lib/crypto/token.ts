import { getSubtleCrypto, getRandomValues, toBase64Url, fromBase64Url } from "./keys";
import { CapabilityTokenPayload } from "./types";

const SERVER_SECRET = process.env.SERVER_SECRET || "phantom_default_secret_key_change_in_production_32bytes";

/**
 * Import server secret key for HMAC-SHA256
 */
async function getServerSecretKey(): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const secretBytes = new TextEncoder().encode(SERVER_SECRET);
  return subtle.importKey(
    "raw",
    secretBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Sign a capability token (HMAC-SHA256)
 * Output: <base64url_payload>.<base64url_signature>
 */
export async function createCapabilityToken(
  fileId: string,
  ttlSeconds = 60,
  scope: "download" | "burn" = "download"
): Promise<{ token: string; nonce: string; expiresAt: number }> {
  const subtle = getSubtleCrypto();
  const nonce = toBase64Url(getRandomValues(new Uint8Array(16)));
  const expiresAt = Date.now() + ttlSeconds * 1000;

  const payload: CapabilityTokenPayload = {
    fileId,
    expiresAt,
    nonce,
    scope,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const payloadBase64 = toBase64Url(payloadBytes);

  const key = await getServerSecretKey();
  const sigBuffer = await subtle.sign("HMAC", key, new TextEncoder().encode(payloadBase64) as BufferSource);
  const signatureBase64 = toBase64Url(sigBuffer);

  return {
    token: `${payloadBase64}.${signatureBase64}`,
    nonce,
    expiresAt,
  };
}

/**
 * Verify capability token authenticity, signature, and expiration
 */
export async function verifyCapabilityToken(
  token: string,
  expectedFileId: string,
  expectedScope: "download" | "burn" = "download"
): Promise<{ valid: boolean; payload?: CapabilityTokenPayload; error?: string }> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) {
      return { valid: false, error: "MALFORMED_TOKEN_STRUCTURE" };
    }

    const [payloadBase64, signatureBase64] = parts;
    const subtle = getSubtleCrypto();
    const key = await getServerSecretKey();
    const signatureBytes = fromBase64Url(signatureBase64);

    const isValidSig = await subtle.verify(
      "HMAC",
      key,
      signatureBytes as BufferSource,
      new TextEncoder().encode(payloadBase64) as BufferSource
    );

    if (!isValidSig) {
      return { valid: false, error: "INVALID_SIGNATURE" };
    }

    const payloadJson = new TextDecoder().decode(fromBase64Url(payloadBase64));
    const payload = JSON.parse(payloadJson) as CapabilityTokenPayload;

    if (payload.fileId !== expectedFileId) {
      return { valid: false, error: "TOKEN_FILE_ID_MISMATCH" };
    }

    if (payload.scope !== expectedScope) {
      return { valid: false, error: "TOKEN_SCOPE_MISMATCH" };
    }

    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: "TOKEN_EXPIRED" };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err.message || "TOKEN_VERIFICATION_FAILED" };
  }
}
