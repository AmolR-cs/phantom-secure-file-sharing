import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FileService } from "@/lib/services/file-service";

const createFileSchema = z.object({
  id: z.string().min(16).max(64),
  salt: z.string().min(10),
  encryptedMetadata: z.string().min(10),
  metadataIv: z.string().min(10),
  noncePrefix: z.string().min(10),
  totalChunks: z.number().int().min(1).max(1000),
  totalSizeBytes: z.number().int().min(1).max(52428800), // Max 50MB
  burnAfterRead: z.boolean(),
  maxDownloads: z.number().int().min(1).max(100),
  expiresInSeconds: z.number().int().min(0).optional(),
  passwordVerifier: z.string().optional(),
  passwordSalt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = createFileSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const file = await FileService.createFile({
      ...parsed.data,
      clientIp,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        fileId: file.id,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "SERVER_ERROR", message: err.message },
      { status: 500 }
    );
  }
}
