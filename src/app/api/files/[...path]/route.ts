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
 *
 * This route only serves the LocalStorage backend. S3 / DO Spaces use
 * their own presigned URL scheme that bypasses our app entirely — on
 * swap, delete this file.
 */

export const dynamic = "force-dynamic";

/** Stricter than encodeURIComponent: strips chars that break the header syntax. */
function safeHeaderFilename(name: string): string {
  return name
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f"\\]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_");
}

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
  if (!(store instanceof LocalStorage)) {
    return NextResponse.json(
      { error: "This storage provider serves signed URLs directly." },
      { status: 404 },
    );
  }
  if (!store.verifySignature(storageKey, exp, sig)) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 401 });
  }

  // Find the row to (a) recover the original filename + MIME for correct
  // headers, and (b) enforce soft-delete: if the file was removed after the
  // URL was signed but before this GET, refuse to serve the bytes. Without
  // this guard, a stale signed URL (up to 5 min) would bypass the delete.
  const row = await prisma.assignmentFile.findFirst({
    where: { storageKey, deletedAt: null },
    select: { originalName: true, mimeType: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const bytes = await store.read(storageKey);
  if (!bytes) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const safeName = safeHeaderFilename(row.originalName);

  // Copy bytes into a fresh ArrayBuffer so Blob's TS signature is satisfied.
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new NextResponse(new Blob([ab], { type: row.mimeType }), {
    status: 200,
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
