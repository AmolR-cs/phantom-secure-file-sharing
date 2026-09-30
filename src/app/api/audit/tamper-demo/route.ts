import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (action === "tamper") {
      // Find latest entry and alter its status to corrupt the cryptographic chain
      const entry = await prisma.auditLog.findFirst({
        orderBy: { sequence: "desc" },
      });

      if (!entry) {
        return NextResponse.json({ error: "NO_ENTRIES_TO_TAMPER" }, { status: 400 });
      }

      await prisma.auditLog.update({
        where: { id: entry.id },
        data: { status: "FORGED_BY_ROGUE_DBA" },
      });

      return NextResponse.json({
        success: true,
        tamperedSequence: entry.sequence,
        message: `Sequence #${entry.sequence} was modified directly in SQLite by an attacker.`,
      });
    }

    if (action === "reset") {
      await prisma.auditLog.deleteMany();
      return NextResponse.json({
        success: true,
        message: "Audit log reset. Genesis chain cleared.",
      });
    }

    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
