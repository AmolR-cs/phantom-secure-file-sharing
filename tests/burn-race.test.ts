import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { FileService } from "../src/lib/services/file-service";
import { defaultStorage } from "../src/lib/storage/local-shredder";

describe("Atomic Burn-After-Read & Concurrency Race Condition Resistance", () => {
  beforeEach(async () => {
    await prisma.chunkRecord.deleteMany();
    await prisma.fileRecord.deleteMany();
    await prisma.auditLog.deleteMany();
  });

  it(
    "guarantees strictly 1 download succeeds across 50 concurrent parallel burn requests",
    async () => {
    const fileId = "test_burn_race_file_001";
    
    // 1. Create a Burn-After-Read file record
    await FileService.createFile({
      id: fileId,
      salt: "dGVzdF9zYWx0XzE2Ynl0ZXM=",
      encryptedMetadata: "dGVzdF9lbmNyeXB0ZWRfbWV0YWRhdGE=",
      metadataIv: "dGVzdF9pdg==",
      noncePrefix: "dGVzdF9ub25jZQ==",
      totalChunks: 1,
      totalSizeBytes: 1024,
      burnAfterRead: true,
      maxDownloads: 1,
      clientIp: "127.0.0.1",
    });

    // Save a simulated encrypted chunk
    const dummyChunk = Buffer.alloc(1024, 0x42);
    await FileService.saveChunk(fileId, 0, dummyChunk);

    // 2. Fire 50 simultaneous concurrent authorization requests (Parallel Race Attack)
    const CONCURRENT_REQUESTS = 50;
    const promises = Array.from({ length: CONCURRENT_REQUESTS }).map((_, index) =>
      FileService.authorizeDownload(fileId, undefined, `10.0.0.${index + 1}`)
    );

    const results = await Promise.all(promises);

    // 3. Evaluate results
    const successfulRequests = results.filter((r) => r.authorized === true);
    const rejectedRequests = results.filter((r) => r.authorized === false);

    expect(successfulRequests.length).toBe(1); // EXACTLY ONE REQUEST WINS
    expect(rejectedRequests.length).toBe(CONCURRENT_REQUESTS - 1); // 49 REQUESTS REJECTED

    // 4. Verify DB state
    const record = await prisma.fileRecord.findUnique({ where: { id: fileId } });
    expect(record?.downloadCount).toBe(1);
    expect(record?.status).toBe("BURNED");

    // 5. Shred and verify zero dangling blobs
    const shredResult = await FileService.shredAndEradicateFile(fileId, "BURN_DOWNLOAD_COMPLETE");
    expect(shredResult.isZeroDangling).toBe(true);

    const isClean = await defaultStorage.verifyZeroDanglingBlobs(fileId);
    expect(isClean).toBe(true);
  }, 30000);

  it("successfully authorizes and issues capability token for file with TTL (expiresInSeconds)", async () => {
    const fileId = "test_ttl_download_file";
    await FileService.createFile({
      id: fileId,
      salt: "dGVzdF9zYWx0XzE2Ynl0ZXM=",
      encryptedMetadata: "dGVzdF9lbmNyeXB0ZWRfbWV0YWRhdGE=",
      metadataIv: "dGVzdF9pdg==",
      noncePrefix: "dGVzdF9ub25jZQ==",
      totalChunks: 1,
      totalSizeBytes: 1024,
      burnAfterRead: true,
      maxDownloads: 1,
      expiresInSeconds: 3600,
      clientIp: "127.0.0.1",
    });

    const authRes = await FileService.authorizeDownload(fileId, undefined, "127.0.0.1");
    expect(authRes.authorized).toBe(true);
    expect(authRes.token).toBeDefined();

    // Verify subsequent burn prevents second download
    const secondRes = await FileService.authorizeDownload(fileId, undefined, "127.0.0.1");
    expect(secondRes.authorized).toBe(false);
  });
});
