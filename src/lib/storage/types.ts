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
 *   directly via a presigned URL.
 * - `delete` is idempotent — succeed if the object is already gone.
 */

export interface StoragePutResult {
  key: string;
  sizeBytes: number;
}

export interface Storage {
  put(
    key: string,
    data: Buffer,
    meta: { mimeType: string },
  ): Promise<StoragePutResult>;

  delete(key: string): Promise<void>;

  getSignedUrl(key: string, ttlSec: number): Promise<string>;
}
