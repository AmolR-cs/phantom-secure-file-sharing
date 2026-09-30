import { NextRequest, NextResponse } from "next/server";
import { FileService } from "@/lib/services/file-service";
import { syntheticTimingPad } from "@/lib/security/timing";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";

  let passwordVerifier: string | undefined;
  try {
    const body = await req.json();
    passwordVerifier = body.passwordVerifier;
  } catch {
    // Body optional if no password
  }

  const result = await FileService.authorizeDownload(id, passwordVerifier, clientIp, userAgent);

  if (!result.authorized) {
    if (result.status === 404 || result.status === 410) {
      await syntheticTimingPad(25, 60);
    }
    return NextResponse.json(
      { error: result.error || "AUTHORIZATION_DENIED" },
      { status: result.status || 403 }
    );
  }

  return NextResponse.json(
    {
      authorized: true,
      token: result.token,
    },
    { status: 200 }
  );
}
