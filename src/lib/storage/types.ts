/**
 * Storage interface — the abstraction that keeps file uploads portable.
 *
 * Swapping dev (local filesystem) for prod (S3, DO Spaces, R2) is one
 * new implementation + an env flag. UI, server actions, and policies
 * never reference a specific backend.
 *
 * Keys are opaque strings owned by the caller's layout (see
 * `makeAssignmentFileKey`). The implementation should not parse them.
 *
 * ### Contract
 *
 * - `put` accepts `meta.mimeType` — S3-like backends bind it to the
 *   stored object's Content-Type; LocalStorage doesn't need it because
 *   our download route reads the MIME from the DB row. Pass it anyway;
 *   implementations that ignore it are free to.
 * - `getSignedUrl` returns an absolute URL the browser can GET to
 *   retrieve the bytes. For LocalStorage this routes through our own
 *   `/api/files/*` handler (HMAC-verified); for S3 it hits the bucket
 *   directly via a presigned URL. `downloadName` controls the save-as
 *   filename via `Content-Disposition`; `inline:true` switches
 *   `attachment` → `inline` for in-browser preview.
 * - `delete` is idempotent — succeed if the object is already gone.
 * - `deleteMany` is the batched equivalent — single round-trip to the
 *   backend where possible (S3 supports up to 1000 keys per call).
 *   Partial failures don't throw; callers that need per-key accounting
 *   use `delete` in a loop.
 * - `exists` is a cheap probe — `true` if the object is there. S3
 *   implementations use `HEAD`; LocalStorage uses `fs.access`. Useful
 *   for diagnostics + health checks.
 */

export interface StoragePutResult {
  key: string;
  sizeBytes: number;
}

export interface SignedUrlOptions {
  /** Seconds until the URL expires. S3/DO Spaces cap at 7 days. */
  ttlSec: number;
  /** Save-as filename. Omit for the object's own name (S3) / key (LocalStorage
   *  route inspects the DB row to recover the original name). */
  downloadName?: string;
  /** Render in-browser (inline) instead of forcing download (attachment).
   *  Default: attachment. */
  inline?: boolean;
}

export interface Storage {
  put(
    key: string,
    data: Buffer,
    meta: { mimeType: string },
  ): Promise<StoragePutResult>;

  delete(key: string): Promise<void>;

  deleteMany(keys: string[]): Promise<void>;

  exists(key: string): Promise<boolean>;

  getSignedUrl(key: string, opts: SignedUrlOptions): Promise<string>;

  /**
   * Read the full object into memory. Returns null when missing. Used by
   * server-side code that needs raw bytes (PDF rendering embeds team logo
   * + signature images, so we can't route through the browser's presigned
   * URL). OK at our per-file caps (≤ 50 MB assignment files, 2 MB branding);
   * swap to a streaming interface if those grow.
   */
  read(key: string): Promise<Buffer | null>;
}
