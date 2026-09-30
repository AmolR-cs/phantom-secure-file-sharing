import { NextRequest, NextResponse } from "next/server";
import { FileService } from "@/lib/services/file-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

  try {
    const result = await FileService.shredAndEradicateFile(id, "MANUAL_REVOCATION", clientIp);
    return NextResponse.json({
      success: true,
      message: "File permanently eradicated.",
      shreddedCount: result.shreddedCount,
      isZeroDangling: result.isZeroDangling,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "SHRED_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
