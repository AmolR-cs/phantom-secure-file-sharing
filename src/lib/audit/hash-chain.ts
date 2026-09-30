import crypto from "crypto";
import { prisma } from "../db/prisma";

export const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

export interface AuditEventInput {
  eventType: string;
  linkId?: string;
  ip: string;
  userAgent?: string;
  status: "SUCCESS" | "BLOCKED" | "EXPIRED" | "TAMPERED" | "REJECTED";
  details?: string;
}

export interface VerificationResult {
  valid: boolean;
  totalEntries: number;
  corruptedSequence?: number;
  reason?: string;
  headHash?: string;
}

/**
 * Anonymize IP address with SHA-256 (Never store raw client IP)
 */
export function hashClientIp(ip: string): string {
  return crypto.createHash("sha256").update(ip || "unknown").digest("hex").slice(0, 16);
}

/**
 * Anonymize User-Agent with SHA-256
 */
export function hashUserAgent(ua?: string): string {
  return crypto.createHash("sha256").update(ua || "unknown").digest("hex").slice(0, 16);
}

/**
 * Compute canonical hash of an audit entry
 */
export function computeEntryHash(
  sequence: number,
  prevHash: string,
  timestampIso: string,
  eventType: string,
  linkId: string,
  ipHash: string,
  userAgentHash: string,
  status: string,
  details: string
): string {
  const payload = [
    sequence,
    prevHash,
    timestampIso,
    eventType,
    linkId,
    ipHash,
    userAgentHash,
    status,
    details,
  ].join("::");

  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Append an entry to the hash-chained audit log inside an atomic transaction
 */
export async function appendAuditLog(input: AuditEventInput): Promise<any> {
  const ipHash = hashClientIp(input.ip);
  const userAgentHash = hashUserAgent(input.userAgent);
  const linkId = input.linkId || "";
  const details = input.details || "";

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const lastEntry = await tx.auditLog.findFirst({
            orderBy: { sequence: "desc" },
          });

          const sequence = (lastEntry?.sequence ?? 0) + 1;
          const prevHash = lastEntry?.currentHash ?? GENESIS_HASH;
          const now = new Date();
          const timestampIso = now.toISOString();

          const currentHash = computeEntryHash(
            sequence,
            prevHash,
            timestampIso,
            input.eventType,
            linkId,
            ipHash,
            userAgentHash,
            input.status,
            details
          );

          return tx.auditLog.create({
            data: {
              sequence,
              prevHash,
              currentHash,
              timestamp: now,
              eventType: input.eventType,
              linkId: input.linkId,
              ipHash,
              userAgentHash,
              status: input.status,
              details: input.details,
            },
          });
        },
        { timeout: 10000 }
      );
    } catch (err: any) {
      if (attempt < 4 && (err?.code === "P2010" || err?.message?.includes("database is locked") || err?.code === "P2028")) {
        await new Promise((r) => setTimeout(r, 20 + Math.random() * 50));
        continue;
      }
      // If still busy, return null rather than crashing
      return null;
    }
  }
}

/**
 * Verify complete hash-chain integrity from Genesis block to current Head.
 * Detects modified payloads, sequence deletions, or chain breaks.
 */
export async function verifyAuditChainIntegrity(): Promise<VerificationResult> {
  const entries = await prisma.auditLog.findMany({
    orderBy: { sequence: "asc" },
  });

  if (entries.length === 0) {
    return {
      valid: true,
      totalEntries: 0,
      headHash: GENESIS_HASH,
    };
  }

  let expectedPrevHash = GENESIS_HASH;
  let expectedSequence = 1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // 1. Verify sequence monotonicity (detect deleted records)
    if (entry.sequence !== expectedSequence) {
      return {
        valid: false,
        totalEntries: entries.length,
        corruptedSequence: expectedSequence,
        reason: `SEQUENCE_GAP_DETECTED: Expected sequence ${expectedSequence}, but found ${entry.sequence}. A row was deleted from the database!`,
      };
    }

    // 2. Verify previous hash pointer
    if (entry.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        corruptedSequence: entry.sequence,
        reason: `PREV_HASH_MISMATCH at sequence ${entry.sequence}: Pointed to ${entry.prevHash}, expected ${expectedPrevHash}. Chain link severed!`,
      };
    }

    // 3. Recompute canonical hash of row contents
    const recomputedHash = computeEntryHash(
      entry.sequence,
      entry.prevHash,
      entry.timestamp.toISOString(),
      entry.eventType,
      entry.linkId || "",
      entry.ipHash,
      entry.userAgentHash,
      entry.status,
      entry.details || ""
    );

    if (entry.currentHash !== recomputedHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        corruptedSequence: entry.sequence,
        reason: `RECORD_TAMPERED at sequence ${entry.sequence}: Stored hash does not match row content digest. Row was altered in the database!`,
      };
    }

    expectedPrevHash = entry.currentHash;
    expectedSequence++;
  }

  return {
    valid: true,
    totalEntries: entries.length,
    headHash: expectedPrevHash,
  };
}
