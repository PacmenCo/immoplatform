import { createHmac, timingSafeEqual } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SignedUrlOptions, Storage, StoragePutResult } from "./types";

/**
 * Filesystem-backed storage for development and self-hosted deployments.
 *
 * Files live under `root` (e.g. `./storage`). The key is the relative path
 * inside that root — the caller chooses the layout.
 *
 * Signed URLs route to `/api/files/{key}?exp={unix}&sig={hmacHex}`; the
 * route handler verifies the HMAC (via `verifySignature`) and reads bytes
 * via `read`. `verifySignature` is LocalStorage-specific — only this
 * backend routes downloads through our server; S3 presigned URLs are
 * verified at the bucket.
 *
 * `downloadName` + `inline` are ignored here — the `/api/files/*` route
 * reads the original filename from the AssignmentFile DB row and sets
 * Content-Disposition server-side. Keeping the opts on the interface
 * means the same call site code works unchanged on S3.
 */
export class LocalStorage implements Storage {
  constructor(
    private readonly root: string,
    private readonly signingSecret: string,
    private readonly appUrl: string,
  ) {}

  private abs(key: string): string {
    if (!key) throw new Error("Storage key must be non-empty.");
    const resolved = path.resolve(this.root, key);
    const rootResolved = path.resolve(this.root);
    if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
      throw new Error("Path escape blocked");
    }
    return resolved;
  }

  async put(key: string, data: Buffer): Promise<StoragePutResult> {
    const absPath = this.abs(key);
    await mkdir(path.dirname(absPath), { recursive: true });
    await writeFile(absPath, data);
    return { key, sizeBytes: data.byteLength };
  }

  async delete(key: string): Promise<void> {
    const absPath = this.abs(key);
    await rm(absPath, { force: true });
  }

  async deleteMany(keys: string[]): Promise<void> {
    // Local filesystem has no batch primitive — fan out in parallel.
    // Per-key errors are swallowed so a partial cleanup doesn't abort the
    // rest; the caller already accepts best-effort semantics at this level.
    await Promise.all(keys.map((k) => this.delete(k).catch(() => {})));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.abs(key));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string, opts: SignedUrlOptions): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + opts.ttlSec;
    const sig = this.sign(key, exp);
    const base = this.appUrl.replace(/\/$/, "");
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    return `${base}/api/files/${encodedKey}?exp=${exp}&sig=${sig}`;
  }

  /**
   * Verify a signed-URL request. Used by the `/api/files/*` route — not on
   * the `Storage` interface because only LocalStorage handles downloads
   * in-process. S3 presigned URLs are verified at the bucket.
   */
  verifySignature(key: string, exp: number, sig: string): boolean {
    if (Number.isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    const expected = this.sign(key, exp);
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.abs(key));
    } catch {
      return null;
    }
  }

  private sign(key: string, exp: number): string {
    return createHmac("sha256", this.signingSecret)
      .update(`${key}|${exp}`)
      .digest("hex");
  }
}
