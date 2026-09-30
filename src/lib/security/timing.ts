import crypto from "crypto";

/**
 * Constant-time string equality comparison using SHA-256 digest buffers.
 * Hashing both inputs first prevents early-exit timing leaks from string length differences.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Introduce a randomized timing delay within [minMs, maxMs]
 * to resist side-channel timing analysis on not-found vs expired endpoints.
 */
export async function syntheticTimingPad(minMs = 30, maxMs = 70): Promise<void> {
  const delay = Math.floor(minMs + Math.random() * (maxMs - minMs));
  return new Promise((resolve) => setTimeout(resolve, delay));
}
