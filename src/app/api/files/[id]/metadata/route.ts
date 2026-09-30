import { NextRequest, NextResponse } from "next/server";
import { FileService } from "@/lib/services/file-service";
import { syntheticTimingPad } from "@/lib/security/timing";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const result = await FileService.getMetadata(id, clientIp, userAgent);

  if (!result.found) {
    // Defeat link enumeration timing analysis: Add synthetic jitter
    await syntheticTimingPad(25, 60);
    return NextResponse.json(
      { error: "RESOURCE_UNAVAILABLE" },
      { status: 404 }
    );
  }

  return NextResponse.json(result.file, { status: 200 });
}
