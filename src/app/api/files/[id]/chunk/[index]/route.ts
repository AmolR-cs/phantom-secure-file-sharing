import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { FileService } from "@/lib/services/file-service";
import { defaultStorage } from "@/lib/storage/local-shredder";
import { verifyCapabilityToken } from "@/lib/crypto/token";
import { appendAuditLog } from "@/lib/audit/hash-chain";
import { threatRadar } from "@/lib/security/sse";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await params;
  const chunkIndex = parseInt(index, 10);

  if (isNaN(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: "INVALID_CHUNK_INDEX" }, { status: 400 });
  }

  const file = await prisma.fileRecord.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "FILE_NOT_FOUND" }, { status: 404 });
  }

  // Read binary chunk payload
  const arrayBuffer = await req.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "CHUNK_SIZE_EXCEEDED" }, { status: 413 });
  }

  await FileService.saveChunk(id, chunkIndex, buffer);

  return NextResponse.json({ success: true, chunkIndex, size: buffer.length }, { status: 201 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await params;
  const chunkIndex = parseInt(index, 10);
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

  if (isNaN(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: "INVALID_CHUNK_INDEX" }, { status: 400 });
  }

  // 1. Extract capability token
  const authHeader = req.headers.get("authorization");
  const urlToken = req.nextUrl.searchParams.get("token");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : urlToken;

  if (!token) {
    threatRadar.emitRadarEvent({
      type: "TAMPER_ATTEMPT",
      ipHash: clientIp,
      status: "BLOCKED",
      details: `Unauthorized chunk access attempt without capability token for ${id.slice(0, 8)}...`,
    });
    return NextResponse.json({ error: "UNAUTHORIZED_CAPABILITY_TOKEN_REQUIRED" }, { status: 401 });
  }

  // 2. Verify capability token signature and scope
  const tokenVerify = await verifyCapabilityToken(token, id, "download");
  if (!tokenVerify.valid || !tokenVerify.payload) {
    threatRadar.emitRadarEvent({
      type: "TAMPER_ATTEMPT",
      ipHash: clientIp,
      status: "BLOCKED",
      details: `Invalid or expired capability token: ${tokenVerify.error}`,
    });
    return NextResponse.json({ error: tokenVerify.error || "INVALID_CAPABILITY_TOKEN" }, { status: 401 });
  }

  // 3. Replay protection: Check if nonce was already consumed for this chunk
  const nonceKey = `${tokenVerify.payload.nonce}_chunk_${chunkIndex}`;
  const existingNonce = await prisma.usedNonce.findUnique({
    where: { nonce: nonceKey },
  });

  if (existingNonce) {
    threatRadar.emitRadarEvent({
      type: "TAMPER_ATTEMPT",
      ipHash: clientIp,
      status: "BLOCKED",
      details: `Replay attack detected: Capability token nonce already used for chunk ${chunkIndex}!`,
    });
    return NextResponse.json(
      { error: "TOKEN_NONCE_ALREADY_USED" },
      { status: 401 }
    );
  }

  // Mark nonce as used
  await prisma.usedNonce.create({
    data: {
      nonce: nonceKey,
      linkId: id,
      expiresAt: new Date(tokenVerify.payload.expiresAt),
    },
  });

  // 4. Retrieve chunk storage record
  const chunkRecord = await prisma.chunkRecord.findUnique({
    where: {
      fileId_chunkIndex: {
        fileId: id,
        chunkIndex,
      },
    },
    include: {
      file: true,
    },
  });

  if (!chunkRecord) {
    return NextResponse.json({ error: "CHUNK_NOT_FOUND" }, { status: 404 });
  }

  // Read raw encrypted bytes from disk
  let chunkBytes: Buffer;
  try {
    chunkBytes = await defaultStorage.getChunk(chunkRecord.storagePath);
  } catch (err: any) {
    return NextResponse.json({ error: "CHUNK_RETRIEVAL_FAILED" }, { status: 500 });
  }

  // 5. If this is the terminal chunk and file was burned, initiate background eradication
  const isLastChunk = chunkIndex === chunkRecord.file.totalChunks - 1;
  if (isLastChunk && chunkRecord.file.status === "BURNED") {
    // Asynchronously shred in next tick so download stream completes
    setTimeout(async () => {
      try {
        await FileService.shredAndEradicateFile(id, "BURN_DOWNLOAD_COMPLETE", clientIp);
      } catch (err) {
        console.error("Async shredding error:", err);
      }
    }, 1500);
  }

  // Log successful chunk access
  await appendAuditLog({
    eventType: "CHUNK_DOWNLOADED",
    linkId: id,
    ip: clientIp,
    status: "SUCCESS",
    details: `Chunk ${chunkIndex + 1}/${chunkRecord.file.totalChunks} streamed`,
  });

  // 6. Return opaque octet-stream with strict anti-caching & anti-inline headers
  return new NextResponse(new Uint8Array(chunkBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="chunk_${chunkIndex}.bin"`,
      "Content-Length": chunkBytes.length.toString(),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
