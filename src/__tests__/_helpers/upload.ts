/**
 * FormData/File construction helpers for upload-related integration tests.
 * Keeping these here instead of local-to-file prevents drift if a future test
 * needs its own variant — all uploads flow through the same builder.
 */

/**
 * Magic-byte prefix per MIME so the server-side magicBytesValid check
 * accepts the stub. Anything outside this map falls through to the raw
 * content (use that to drive negative tests).
 */
const MAGIC_PREFIX: Record<string, Uint8Array> = {
  "application/pdf": new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]), // %PDF-1.4\n
  "image/jpeg": new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
  "image/png": new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/webp": new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]),
};

/** Build a stub File the upload action will accept (PDF by default). */
export function makeUploadFile(
  name: string,
  type = "application/pdf",
  content = "hello",
): File {
  // Browser File subclass inherits from Blob — Node's global File (≥ 20.x)
  // is fine. Embed the matching magic-byte prefix so server-side
  // magicBytesValid passes; tests that want to fail that check should pass
  // an unrecognized `type` or assemble their own File with raw bytes.
  const prefix = MAGIC_PREFIX[type];
  const parts: BlobPart[] = prefix ? [Buffer.from(prefix), content] : [content];
  return new File(parts, name, { type });
}

/** Build a multi-file FormData payload matching `uploadAssignmentFiles`. */
export function uploadForm(...files: File[]): FormData {
  const fd = new FormData();
  for (const f of files) fd.append("file", f);
  return fd;
}
