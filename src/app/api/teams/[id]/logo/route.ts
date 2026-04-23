import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { LocalStorage, storage } from "@/lib/storage";
import { TEAM_LOGO_EXT_TO_MIME } from "@/lib/teamBranding";
import { IMAGE_SAFETY_HEADERS } from "@/lib/imageServeHeaders";

/**
 * Serves a team's logo bytes. Session-gated — team logos show on the
 * dashboard sidebar, assignment rows, and team cards across the app, so
 * any signed-in user can fetch any team's logo.
 *
 * On LocalStorage we stream bytes from disk. On S3 / DO Spaces we 302
 * redirect to a short-lived presigned URL so browsers fetch directly
 * from the bucket — the same pattern as avatars.
 */

export const dynamic = "force-dynamic";

const PRESIGNED_TTL_SEC = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    select: { logoUrl: true },
  });
  if (!team?.logoUrl) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const store = storage();

  if (!(store instanceof LocalStorage)) {
    const signed = await store.getSignedUrl(team.logoUrl, {
      ttlSec: PRESIGNED_TTL_SEC,
      inline: true,
    });
    return NextResponse.redirect(signed, {
      status: 302,
      headers: { "Cache-Control": "private, max-age=300" },
    });
  }

  const bytes = await store.read(team.logoUrl);
  if (!bytes) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const ext = team.logoUrl.split(".").pop()?.toLowerCase() ?? "";
  const mime = TEAM_LOGO_EXT_TO_MIME[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
      ...IMAGE_SAFETY_HEADERS,
    },
  });
}
