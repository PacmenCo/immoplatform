import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { SignedUrlOptions, Storage, StoragePutResult } from "./types";

/**
 * AWS S3 / DigitalOcean Spaces / Cloudflare R2 / any S3-compatible backend.
 *
 * Bucket + region + credentials + optional endpoint are supplied by the
 * factory in `./index.ts`; this class is backend-agnostic within the
 * S3 API surface. DO Spaces set the `endpoint` override (e.g.
 * `https://nyc3.digitaloceanspaces.com`); AWS leaves it unset so the
 * SDK picks the regional default.
 *
 * ### Error-handling contract
 * - `put` propagates any AWS error — upload failures must be visible.
 * - `delete` swallows `NoSuchKey` / `NotFound` (idempotent); other errors propagate.
 * - `deleteMany` uses S3's batch `DeleteObjects` (max 1000 keys per call);
 *   per-key failures inside the batch are accepted silently (matches
 *   `LocalStorage.deleteMany` semantics).
 * - `exists` returns false on `NotFound`, re-throws other errors — so a
 *   403 from a mis-configured bucket surfaces instead of silently saying
 *   the object is missing.
 * - `getSignedUrl` defaults to `attachment` content-disposition with the
 *   provided `downloadName`; `inline:true` switches to inline rendering.
 *   RFC 5987 filename encoding handles non-ASCII names.
 */
export class S3Storage implements Storage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async put(
    key: string,
    data: Buffer,
    meta: { mimeType: string },
  ): Promise<StoragePutResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: meta.mimeType,
      }),
    );
    return { key, sizeBytes: data.byteLength };
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      if (err instanceof NoSuchKey || err instanceof NotFound) return;
      throw err;
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    // S3's DeleteObjects maxes at 1000 entries per request; chunk so a
    // 2000-file assignment still clears in two round-trips instead of 2000.
    const CHUNK = 1000;
    for (let i = 0; i < keys.length; i += CHUNK) {
      const chunk = keys.slice(i, i + CHUNK);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: chunk.map((k) => ({ Key: k })),
            Quiet: true,
          },
        }),
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (err) {
      if (err instanceof NotFound || (err as { name?: string }).name === "NotFound") {
        return false;
      }
      throw err;
    }
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (err) {
      if (err instanceof NoSuchKey || err instanceof NotFound) return null;
      throw err;
    }
  }

  async getSignedUrl(key: string, opts: SignedUrlOptions): Promise<string> {
    const disposition = opts.downloadName
      ? buildContentDisposition(opts.downloadName, opts.inline ?? false)
      : undefined;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: disposition,
      }),
      { expiresIn: opts.ttlSec },
    );
  }
}

/**
 * RFC 5987 / 6266 content-disposition with safe ASCII fallback + UTF-8 form
 * for browsers that honour it. Prevents non-ASCII filenames from breaking
 * the header (would reject the whole signed URL).
 */
function buildContentDisposition(filename: string, inline: boolean): string {
  const mode = inline ? "inline" : "attachment";
  const safe = filename
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f"\\]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_");
  const utf8 = encodeURIComponent(filename);
  return `${mode}; filename="${safe}"; filename*=UTF-8''${utf8}`;
}
