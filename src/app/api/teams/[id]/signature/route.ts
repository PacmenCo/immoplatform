import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { LocalStorage, storage } from "@/lib/storage";
import { TEAM_SIGNATURE_EXT_TO_MIME } from "@/lib/teamBranding";

/**
 * Serves a team's signature image. Unlike the logo, this is more
 * restricted — signatures are legal artefacts stamped on certificates
 * and contracts, so only admin/staff and the team's own members can
 * fetch the raw bytes. Other users see signatures embedded in generated
 * PDFs but never hit this endpoint directly.
 *
 * On LocalStorage we stream bytes from disk. On S3 / DO Spaces we 302
 * redirect to a short-lived presigned URL.
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

  // Gate: admin/staff, OR members of this specific team. Non-members of
  // another team should not be able to probe for signature images.
  if (!hasRole(session, "admin", "staff")) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: id, userId: session.user.id } },
      select: { userId: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
  }

  const team = await prisma.team.findUnique({
    where: { id },
    select: { signatureUrl: true },
  });
  if (!team?.signatureUrl) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const store = storage();

  if (!(store instanceof LocalStorage)) {
    const signed = await store.getSignedUrl(team.signatureUrl, {
      ttlSec: PRESIGNED_TTL_SEC,
      inline: true,
    });
    return NextResponse.redirect(signed, {
      status: 302,
      headers: { "Cache-Control": "private, max-age=300" },
    });
  }

  const bytes = await store.read(team.signatureUrl);
  if (!bytes) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const ext = team.signatureUrl.split(".").pop()?.toLowerCase() ?? "";
  const mime = TEAM_SIGNATURE_EXT_TO_MIME[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
