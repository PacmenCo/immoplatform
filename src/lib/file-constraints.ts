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

export const FILE_CONSTRAINTS: Record<FileLane, LaneConstraints> = {
  freelancer: {
    maxMB: 50,
    allowedMimes: ["application/pdf"],
    acceptHint: "PDF only · up to 50 MB · up to 20 files per upload",
  },
  realtor: {
    maxMB: 10,
    allowedMimes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    acceptHint: "PDF, JPG, PNG, WebP · up to 10 MB each · up to 20 files per upload",
  },
} as const;

export const MAX_FILES_PER_UPLOAD = 20;

export function isLane(value: string): value is FileLane {
  return value === "freelancer" || value === "realtor";
}
