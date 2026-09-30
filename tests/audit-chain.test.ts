import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import {
  appendAuditLog,
  verifyAuditChainIntegrity,
  GENESIS_HASH,
} from "../src/lib/audit/hash-chain";

describe("Tamper-Evident Hash-Chained Audit Trail", () => {
  beforeEach(async () => {
    // Clean audit table before each test
    await prisma.auditLog.deleteMany();
  });

  afterAll(async () => {
    // Clean audit table after tests so test-injected corruptions do not persist in dev.db
    await prisma.auditLog.deleteMany();
  });

  it("initializes an empty chain with valid status pointing to GENESIS_HASH", async () => {
    const res = await verifyAuditChainIntegrity();
    expect(res.valid).toBe(true);
    expect(res.totalEntries).toBe(0);
    expect(res.headHash).toBe(GENESIS_HASH);
  });

  it("creates valid sequentially chained entries", async () => {
    await appendAuditLog({
      eventType: "FILE_UPLOADED",
      linkId: "file_test_1",
      ip: "192.168.1.100",
      userAgent: "Mozilla/5.0",
      status: "SUCCESS",
      details: "Upload 3 chunks",
    });

    await appendAuditLog({
      eventType: "FILE_ACCESSED",
      linkId: "file_test_1",
      ip: "10.0.0.5",
      userAgent: "Curl/8.0",
      status: "SUCCESS",
      details: "Metadata requested",
    });

    await appendAuditLog({
      eventType: "FILE_BURNED",
      linkId: "file_test_1",
      ip: "10.0.0.5",
      userAgent: "Curl/8.0",
      status: "SUCCESS",
      details: "Burn-after-read triggered",
    });

    const verification = await verifyAuditChainIntegrity();
    expect(verification.valid).toBe(true);
    expect(verification.totalEntries).toBe(3);
    expect(verification.corruptedSequence).toBeUndefined();
  });

  it("detects when a row in the database has been tampered with or edited", async () => {
    await appendAuditLog({
      eventType: "FILE_UPLOADED",
      linkId: "file_test_tamper",
      ip: "1.1.1.1",
      status: "SUCCESS",
      details: "Legitimate upload",
    });

    const entry2 = await appendAuditLog({
      eventType: "FILE_ACCESSED",
      linkId: "file_test_tamper",
      ip: "2.2.2.2",
      status: "SUCCESS",
      details: "Legitimate access",
    });

    await appendAuditLog({
      eventType: "CHUNK_DOWNLOADED",
      linkId: "file_test_tamper",
      ip: "2.2.2.2",
      status: "SUCCESS",
      details: "Chunk 0 downloaded",
    });

    // Adversary directly alters row 2 in database to hide access
    await prisma.auditLog.update({
      where: { id: entry2.id },
      data: { status: "TAMPERED_BY_ATTACKER" },
    });

    const verification = await verifyAuditChainIntegrity();
    expect(verification.valid).toBe(false);
    expect(verification.corruptedSequence).toBe(2);
    expect(verification.reason).toContain("RECORD_TAMPERED");
  });

  it("detects when an audit record has been deleted from the database", async () => {
    await appendAuditLog({
      eventType: "FILE_UPLOADED",
      linkId: "file_gap",
      ip: "1.1.1.1",
      status: "SUCCESS",
    });

    const entry2 = await appendAuditLog({
      eventType: "FILE_ACCESSED",
      linkId: "file_gap",
      ip: "2.2.2.2",
      status: "SUCCESS",
    });

    await appendAuditLog({
      eventType: "FILE_BURNED",
      linkId: "file_gap",
      ip: "2.2.2.2",
      status: "SUCCESS",
    });

    // Adversary deletes sequence 2 to cover their tracks
    await prisma.auditLog.delete({
      where: { id: entry2.id },
    });

    const verification = await verifyAuditChainIntegrity();
    expect(verification.valid).toBe(false);
    expect(verification.corruptedSequence).toBe(2);
    expect(verification.reason).toContain("SEQUENCE_GAP_DETECTED");
  });
});
