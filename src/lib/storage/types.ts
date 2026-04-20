/**
 * Storage interface — the abstraction that keeps file uploads portable.
 *
 * Swapping dev (local filesystem) for prod (S3, DO Spaces, R2) is one
 * new implementation + an env flag. UI, server actions, and policies
 * never reference a specific backend.
 *
 * Keys are opaque strings owned by the implementation — callers should
 * not parse or build paths by hand. Use `makeStorageKey()` in the caller
 * to generate a key, then hand it to the storage layer.
 */

export interface StoragePutResult {
  key: string;
  sizeBytes: number;
}

export interface Storage {
  /**
   * Write bytes to the given key. Overwrites if the key exists.
   * The caller is responsible for making the key unique (e.g. include a cuid).
   */
  put(
    key: string,
    data: Buffer,
    meta: { mimeType: string },
  ): Promise<StoragePutResult>;

  /**
   * Read a Web `ReadableStream` for the given key, or null if not found.
   * Caller streams the response to the HTTP body.
   */
  getStream(key: string): Promise<ReadableStream<Uint8Array> | null>;

  /**
   * Permanently delete the object at `key`. Idempotent — succeeds if
   * the object already doesn't exist.
   */
  delete(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;

  /**
   * Return an absolute or path-relative URL that grants time-limited
   * read access to the object. The URL should be self-validating
   * (e.g. HMAC-signed) so no server-side session lookup is needed
   * on download — just signature verification.
   */
  getSignedUrl(key: string, ttlSec: number): Promise<string>;
}
