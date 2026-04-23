import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { LocalStorage, storage } from "@/lib/storage";
import { AVATAR_EXT_TO_MIME } from "@/lib/avatar";

/**
 * Serves a user's avatar bytes. Session-gated — any signed-in dashboard
 * user can fetch any colleague's avatar, since avatars appear on team
 * pages, comments, and assignments regardless of viewer/target role.
 *
 * On LocalStorage the bytes stream from disk through this route. On S3 /
 * DO Spaces we redirect to a short-lived presigned URL so the browser
 * fetches directly from the bucket — no server bytes on the hot path.
 * The `?v=` segment in the caller URL rotates on every upload, which
 * busts both the redirect cache and the underlying bytes cache.
 */

export const dynamic = "force-dynamic";

/** 1 hour — well under AWS's 7-day max and long enough that a page render
 *  can reuse the same presigned URL if the client refreshes. Redirect
 *  response itself caches for a shorter window (5 min) so expired URLs
 *  don't get served from the browser cache. */
const PRESIGNED_TTL_SEC = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { userId } = await params;
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  if (!target?.avatarUrl) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const store = storage();

  // S3-family backend: one-hop redirect to a short-lived presigned URL. The
  // browser fetches bytes directly from DO Spaces; we serve only the redirect.
  if (!(store instanceof LocalStorage)) {
    const signed = await store.getSignedUrl(target.avatarUrl, {
      ttlSec: PRESIGNED_TTL_SEC,
      inline: true,
    });
    return NextResponse.redirect(signed, {
      status: 302,
      headers: {
        // Short cache on the redirect decision so expired signed URLs don't
        // linger in the browser cache. Browsers cache the target bytes
        // separately per DO's response headers.
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  const bytes = await store.read(target.avatarUrl);
  if (!bytes) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const ext = target.avatarUrl.split(".").pop()?.toLowerCase() ?? "";
  const mime = AVATAR_EXT_TO_MIME[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
