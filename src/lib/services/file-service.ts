import { prisma } from "../db/prisma";
import { defaultStorage } from "../storage/local-shredder";
import { appendAuditLog } from "../audit/hash-chain";
import { threatRadar } from "../security/sse";
import { timingSafeEqualString } from "../security/timing";
import { rateLimiter } from "../security/rate-limiter";
import { createCapabilityToken } from "../crypto/token";

export interface CreateFileInput {
  id: string; // 128-bit hex CSPRNG
  salt: string;
  encryptedMetadata: string;
  metadataIv: string;
  noncePrefix: string;
  totalChunks: number;
  totalSizeBytes: number;
  burnAfterRead: boolean;
  maxDownloads: number;
  expiresInSeconds?: number;
  passwordVerifier?: string;
  passwordSalt?: string;
  clientIp: string;
  userAgent?: string;
}

export class FileService {
  /**
   * Register a new encrypted file record and associate storage paths
   */
  static async createFile(input: CreateFileInput) {
    const expiresAt = input.expiresInSeconds !== undefined && input.expiresInSeconds !== null
      ? new Date(Date.now() + input.expiresInSeconds * 1000)
      : null;

    const file = await prisma.fileRecord.create({
      data: {
        id: input.id,
        salt: input.salt,
        encryptedMetadata: input.encryptedMetadata,
        metadataIv: input.metadataIv,
        noncePrefix: input.noncePrefix,
        totalChunks: input.totalChunks,
        totalSizeBytes: input.totalSizeBytes,
        burnAfterRead: input.burnAfterRead,
        maxDownloads: input.burnAfterRead ? 1 : input.maxDownloads,
        downloadCount: 0,
        expiresAt,
        passwordVerifier: input.passwordVerifier || null,
        passwordSalt: input.passwordSalt || null,
        status: "ACTIVE",
      },
    });

    // Record in Tamper-Evident Audit Log
    await appendAuditLog({
      eventType: "FILE_UPLOADED",
      linkId: file.id,
      ip: input.clientIp,
      userAgent: input.userAgent,
      status: "SUCCESS",
      details: `Chunks: ${input.totalChunks} | BurnAfterRead: ${input.burnAfterRead} | MaxDL: ${input.maxDownloads}`,
    });

    // Emit live event to Threat Radar
    threatRadar.emitRadarEvent({
      type: "UPLOAD",
      ipHash: input.clientIp,
      status: "ALLOWED",
      details: `Encrypted file ${file.id.slice(0, 8)}... created (${input.totalChunks} chunks)`,
    });

    return file;
  }

  /**
   * Save a single chunk to the secure shredder storage
   */
  static async saveChunk(fileId: string, chunkIndex: number, data: Buffer) {
    const storagePath = await defaultStorage.saveChunk(fileId, chunkIndex, data);

    await prisma.chunkRecord.upsert({
      where: {
        fileId_chunkIndex: {
          fileId,
          chunkIndex,
        },
      },
      create: {
        fileId,
        chunkIndex,
        chunkSize: data.length,
        storagePath,
      },
      update: {
        chunkSize: data.length,
        storagePath,
      },
    });

    return storagePath;
  }

  /**
   * Get public metadata for a file, enforcing TTL expiry atomically
   */
  static async getMetadata(fileId: string, clientIp: string, userAgent?: string) {
    const file = await prisma.fileRecord.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return { found: false, error: "RESOURCE_UNAVAILABLE" };
    }

    const now = new Date();

    // Check if expired
    if (file.expiresAt && file.expiresAt < now && file.status === "ACTIVE") {
      // Trigger hard shredding immediately
      await this.shredAndEradicateFile(fileId, "TTL_EXPIRED", clientIp);
      return { found: false, error: "RESOURCE_UNAVAILABLE" };
    }

    if (file.status !== "ACTIVE") {
      return { found: false, error: "RESOURCE_UNAVAILABLE" };
    }

    return {
      found: true,
      file: {
        id: file.id,
        salt: file.salt,
        encryptedMetadata: file.encryptedMetadata,
        metadataIv: file.metadataIv,
        noncePrefix: file.noncePrefix,
        totalChunks: file.totalChunks,
        totalSizeBytes: file.totalSizeBytes,
        burnAfterRead: file.burnAfterRead,
        maxDownloads: file.maxDownloads,
        downloadCount: file.downloadCount,
        expiresAt: file.expiresAt ? file.expiresAt.toISOString() : null,
        hasPassword: !!file.passwordVerifier,
        passwordSalt: file.passwordSalt,
        status: file.status,
      },
    };
  }

  /**
   * Atomically authorize a download attempt and issue a single-use capability token.
   * Parallel-request race conditions are eliminated using conditional updates.
   */
  static async authorizeDownload(
    fileId: string,
    passwordVerifier?: string,
    clientIp = "127.0.0.1",
    userAgent = "unknown"
  ): Promise<{ authorized: boolean; token?: string; error?: string; status?: number }> {
    const rateKey = `auth:${clientIp}:${fileId}`;

    // 1. Check brute-force lockout
    const lockout = rateLimiter.isLockedOut(rateKey);
    if (lockout.locked) {
      threatRadar.emitRadarEvent({
        type: "RATE_LIMIT",
        ipHash: clientIp,
        status: "BLOCKED",
        details: `Brute-force lockout active. Retry in ${Math.ceil(lockout.remainingMs / 1000)}s`,
      });
      return {
        authorized: false,
        error: `TOO_MANY_ATTEMPTS: Locked out for ${Math.ceil(lockout.remainingMs / 1000)} seconds.`,
        status: 429,
      };
    }

    const file = await prisma.fileRecord.findUnique({
      where: { id: fileId },
    });

    if (!file || file.status !== "ACTIVE") {
      return { authorized: false, error: "RESOURCE_UNAVAILABLE", status: 404 };
    }

    // Check expiration
    const now = new Date();
    if (file.expiresAt && file.expiresAt < now) {
      await this.shredAndEradicateFile(fileId, "TTL_EXPIRED", clientIp);
      return { authorized: false, error: "RESOURCE_UNAVAILABLE", status: 410 };
    }

    // 2. Validate Password if required
    if (file.passwordVerifier) {
      if (!passwordVerifier) {
        return { authorized: false, error: "PASSWORD_REQUIRED", status: 401 };
      }

      const isValidPassword = timingSafeEqualString(file.passwordVerifier, passwordVerifier);
      if (!isValidPassword) {
        const lockoutCheck = rateLimiter.recordFailedAttempt(rateKey, 5, 20_000);
        await appendAuditLog({
          eventType: "PASSWORD_ATTEMPT_FAILED",
          linkId: fileId,
          ip: clientIp,
          userAgent,
          status: "REJECTED",
          details: `Invalid verifier. Lockout: ${lockoutCheck.locked}`,
        });
        threatRadar.emitRadarEvent({
          type: "TAMPER_ATTEMPT",
          ipHash: clientIp,
          status: "BLOCKED",
          details: `Password verification failed for link ${fileId.slice(0, 8)}...`,
        });

        if (lockoutCheck.locked) {
          return {
            authorized: false,
            error: "RATE_LIMITED: Too many incorrect password attempts. IP locked out.",
            status: 429,
          };
        }
        return { authorized: false, error: "INVALID_PASSWORD", status: 401 };
      }

      // Password valid: clear attempts
      rateLimiter.clearFailedAttempts(rateKey);
    }

    // 3. ATOMIC CONDITIONAL UPDATE TO PREVENT BURN RACE CONDITIONS
    // In a single SQL execution:
    // UPDATE FileRecord SET downloadCount = downloadCount + 1,
    // status = CASE WHEN (burnAfterRead = 1 OR downloadCount + 1 >= maxDownloads) THEN 'BURNED' ELSE status END
    // WHERE id = ? AND status = 'ACTIVE' AND downloadCount < maxDownloads
    let updated = 0;
    try {
      updated = await prisma.$executeRaw`
        UPDATE FileRecord
        SET downloadCount = downloadCount + 1,
            status = CASE 
              WHEN burnAfterRead = 1 OR downloadCount + 1 >= maxDownloads THEN 'BURNED'
              ELSE 'ACTIVE'
            END,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${fileId}
          AND status = 'ACTIVE'
          AND (expiresAt IS NULL OR expiresAt > ${now})
          AND downloadCount < maxDownloads
      `;
    } catch (err: any) {
      if (err?.code === "P2010" || err?.message?.includes("database is locked")) {
        // Under heavy concurrency, request that fails to acquire exclusive write lock loses the race
        updated = 0;
      } else {
        throw err;
      }
    }

    // If updated === 0, another concurrent request won the download race!
    if (updated === 0) {
      threatRadar.emitRadarEvent({
        type: "TAMPER_ATTEMPT",
        ipHash: clientIp,
        status: "BLOCKED",
        details: `Parallel burn race defeated: Request lost atomic download race for ${fileId.slice(0, 8)}...`,
      });
      return { authorized: false, error: "RESOURCE_UNAVAILABLE", status: 410 };
    }

    // Refresh updated record to check if file was burned
    const refreshed = await prisma.fileRecord.findUnique({ where: { id: fileId } });
    const isBurned = refreshed?.status === "BURNED";

    // 4. Issue Capability Token (60-second TTL)
    const { token, nonce, expiresAt: tokenExp } = await createCapabilityToken(fileId, 60, "download");

    await appendAuditLog({
      eventType: isBurned ? "FILE_BURNED" : "DOWNLOAD_AUTHORIZED",
      linkId: fileId,
      ip: clientIp,
      userAgent,
      status: "SUCCESS",
      details: `Token issued | Burned: ${isBurned} | Count: ${refreshed?.downloadCount}/${refreshed?.maxDownloads}`,
    });

    threatRadar.emitRadarEvent({
      type: isBurned ? "BURN" : "DOWNLOAD",
      ipHash: clientIp,
      status: isBurned ? "BURNED" : "ALLOWED",
      details: isBurned
        ? `Burn-after-read triggered for ${fileId.slice(0, 8)}... Blobs scheduled for shredding.`
        : `Download authorized for ${fileId.slice(0, 8)}... (Count ${refreshed?.downloadCount})`,
    });

    return {
      authorized: true,
      token,
      status: 200,
    };
  }

  /**
   * Irrevocable multi-pass zero-overwrite and unlinking of all chunks
   */
  static async shredAndEradicateFile(fileId: string, reason: string, clientIp = "127.0.0.1") {
    // 1. Mark file status as BURNED / EXPIRED immediately
    await prisma.fileRecord.updateMany({
      where: { id: fileId },
      data: {
        status: reason === "TTL_EXPIRED" ? "EXPIRED" : "BURNED",
        shreddedAt: new Date(),
        encryptedMetadata: "[ERADICATED]",
      },
    });

    // 2. Perform 3-pass DoD 5220.22-M overwrite on disk
    const shredResult = await defaultStorage.shredAllFileChunks(fileId);

    // 3. Verify zero dangling blobs
    const isZeroDangling = await defaultStorage.verifyZeroDanglingBlobs(fileId);

    // 4. Clean DB chunk references
    await prisma.chunkRecord.deleteMany({
      where: { fileId },
    });

    // 5. Append tamper-evident audit record
    await appendAuditLog({
      eventType: reason === "TTL_EXPIRED" ? "FILE_EXPIRED" : "FILE_BURNED",
      linkId: fileId,
      ip: clientIp,
      status: "SUCCESS",
      details: `Shredded ${shredResult.shreddedCount} chunks. ZeroDanglingVerified: ${isZeroDangling}. Reason: ${reason}`,
    });

    threatRadar.emitRadarEvent({
      type: "BURN",
      ipHash: clientIp,
      status: "BURNED",
      details: `Hard-delete completed for ${fileId.slice(0, 8)}... (${shredResult.shreddedCount} chunks overwritten & unlinked)`,
    });

    return { shreddedCount: shredResult.shreddedCount, isZeroDangling };
  }

  /**
   * Background sweep for expired files
   */
  static async sweepExpiredFiles(): Promise<number> {
    const now = new Date();
    const expiredFiles = await prisma.fileRecord.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: {
          lt: now,
        },
      },
      select: { id: true },
    });

    for (const f of expiredFiles) {
      await this.shredAndEradicateFile(f.id, "TTL_EXPIRED", "0.0.0.0");
    }

    return expiredFiles.length;
  }
}
