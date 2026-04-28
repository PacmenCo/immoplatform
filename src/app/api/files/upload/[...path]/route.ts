import { NextResponse } from "next/server";
import { LocalStorage, storage } from "@/lib/storage";

/**
 * Signed-upload endpoint for the LocalStorage backend. The browser PUTs
 * the raw file bytes here using a URL minted by `LocalStorage.getPresignedUploadUrl`.
 *
 * This is deliberately session-less: the signed URL IS the auth — the
 * server already validated the user's permission to upload to this key
 * inside `presignAssignmentFileUpload` before issuing the URL.
 *
 * S3 / DO Spaces presign their own PUT URLs that bypass this app entirely.
 * On a permanent local-storage swap, this file can be deleted.
 */

export const dynamic = "force-dynamic";

/** 600 MB hard ceiling — generous headroom over the freelancer-lane cap.
 *  Keeps a runaway client from filling /storage on the dev box. The action
 *  layer enforces the lane-specific cap before issuing the URL; this is a
 *  defense-in-depth on the route handler. */
const MAX_BODY_BYTES = 600 * 1024 * 1024;

export async function PUT(
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
      { error: "This storage provider accepts uploads directly." },
      { status: 404 },
    );
  }
  if (!store.verifySignature("PUT", storageKey, exp, sig)) {
    return NextResponse.json(
      { error: "Invalid or expired upload URL." },
      { status: 401 },
    );
  }

  const declaredLen = Number(req.headers.get("content-length") ?? "0");
  if (declaredLen > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Body too large." },
      { status: 413 },
    );
  }

  // ArrayBuffer materializes the whole body in memory. That's deliberate:
  // dev-only path, no streaming complexity, fine on a workstation. Prod
  // takes the S3 path and never executes this route.
  const ab = await req.arrayBuffer();
  if (ab.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Body too large." }, { status: 413 });
  }

  await store.writeUploaded(storageKey, Buffer.from(ab));
  return NextResponse.json({ ok: true, sizeBytes: ab.byteLength });
}
