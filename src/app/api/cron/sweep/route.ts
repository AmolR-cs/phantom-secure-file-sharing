import { NextRequest, NextResponse } from "next/server";
import { FileService } from "@/lib/services/file-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const swept = await FileService.sweepExpiredFiles();
    return NextResponse.json({
      success: true,
      sweptFilesCount: swept,
      message: `DoD shredding sweep completed. ${swept} expired files eradicated.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "SWEEP_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
