import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyAuditChainIntegrity } from "@/lib/audit/hash-chain";

export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100", 10);

    const [entries, verification] = await Promise.all([
      prisma.auditLog.findMany({
        take: limit,
        orderBy: { sequence: "desc" },
      }),
      verifyAuditChainIntegrity(),
    ]);

    return NextResponse.json({
      verification,
      entries,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "AUDIT_FETCH_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
