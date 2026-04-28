/**
 * Upload constraints per file lane. The client uses these to reject before
 * submit; the server re-validates before writing to storage.
 *
 * Freelancer lane = final deliverables (certificate PDFs). PDF-only.
 * Realtor lane    = supporting docs (floor plans, photos, key notes).
 *                   PDF + common images.
 */

export type FileLane = "freelancer" | "realtor";

export interface LaneConstraints {
  readonly maxMB: number;
  readonly allowedMimes: readonly string[];
  readonly acceptHint: string; // shown in Dropzone hint text
}

// Caps match v1 Platform parity (resources/js/pages/assignments/edit.js):
//   freelancer (`files[]`): 5 GB / 10 files in v1 → 500 MB here, plenty for
//     an inspector PDF and well under the 1 hour presign window; v1's 5 GB
//     was effectively "no cap" via chunked FilePond.
//   realtor (`makelaar_files[]`): 100 MB / 10 files — exact v1 parity.
// Files tab uploads go direct-to-storage (presign → browser PUT → finalize)
// so droplet RAM isn't a constraint. The at-assignment-create flow
// (assignments.ts) still routes realtor bytes through Node; in the
// pathological 10×100 MB case that would pressure a 1 GB box, but typical
// realtor files (photos, floor plans) sit well below the cap.
export const FILE_CONSTRAINTS: Record<FileLane, LaneConstraints> = {
  freelancer: {
    maxMB: 500,
    allowedMimes: ["application/pdf"],
    acceptHint: "PDF only · up to 500 MB · up to 20 files per upload",
  },
  realtor: {
    maxMB: 100,
    allowedMimes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    acceptHint: "PDF, JPG, PNG, WebP · up to 100 MB each · up to 20 files per upload",
  },
} as const;

export const MAX_FILES_PER_UPLOAD = 20;

/**
 * Cap on realtor-lane supporting files attached at assignment-create time.
 * Tighter than the per-upload cap because the create form is a one-shot
 * "starter set" — additional files go through the Files tab afterwards.
 * Single source of truth for both the client form and the server action.
 */
export const MAX_REALTOR_FILES_AT_CREATE = 10;

export function isLane(value: string): value is FileLane {
  return value === "freelancer" || value === "realtor";
}

/**
 * Verify the file's first bytes match its claimed MIME. Defends against
 * polyglot uploads — e.g. an HTML file declared as `application/pdf` so
 * `file.type` passes the MIME allowlist but the body executes if the file
 * is ever served inline. PDF spec allows up to 1024 bytes of leading
 * garbage before `%PDF`, so we scan that window rather than only byte 0.
 *
 * Returns true for any MIME we don't recognize — the allowlist already
 * gates which MIMEs reach this check.
 */
export function magicBytesValid(bytes: Uint8Array, mime: string): boolean {
  switch (mime.toLowerCase()) {
    case "application/pdf": {
      const limit = Math.min(bytes.length, 1024);
      for (let i = 0; i + 3 < limit; i++) {
        if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46) {
          return true;
        }
      }
      return false;
    }
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    case "image/webp":
      return (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    default:
      return true;
  }
}
