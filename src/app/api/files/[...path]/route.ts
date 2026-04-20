import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { LocalStorage, storage } from "@/lib/storage";

/**
 * Signed-download endpoint. The URL arrives pre-authorized via HMAC —
 * the browser clicks a `getSignedUrl()`-generated link. We verify the
 * signature, stream the file, and set sane Content-Disposition so the
 * user sees the original filename.
 *
 * This is deliberately session-less: the signed URL IS the auth. That
 * keeps it cacheable (within the 5-min TTL) and means direct links
 * shared within the TTL window work without a re-authenticate round-trip.
 */

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const storageKey = path.map(decodeURIComponent).join("/");
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";

  const store = storage();
  // Signature verification is implementation-specific. Local FS: HMAC.
  // S3 would verify via AWS SDK's own presigned URL scheme.
  if (!(store instanceof LocalStorage)) {
    return NextResponse.json(
      { error: "This storage provider serves signed URLs directly." },
      { status: 404 },
    );
  }
  if (!store.verifySignature(storageKey, exp, sig)) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 401 });
  }

  // Best-effort filename lookup for Content-Disposition. If the DB row is
  // gone (soft-deleted + purged), fall back to the last path segment.
  const row = await prisma.assignmentFile.findFirst({
    where: { storageKey, deletedAt: null },
    select: { originalName: true, mimeType: true },
  });

  const bytes = await store.readBuffer(storageKey);
  if (!bytes) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const filename = row?.originalName ?? storageKey.split("/").pop() ?? "file";
  const contentType = row?.mimeType ?? "application/octet-stream";

  // Copy bytes into a fresh ArrayBuffer so Blob's TS signature is satisfied.
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new NextResponse(new Blob([ab], { type: contentType }), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${encodeAscii(filename)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

/** RFC 5987 style fallback — strip non-ASCII so the header is portable. */
function encodeAscii(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[^\x20-\x7e]/g, "_");
}
