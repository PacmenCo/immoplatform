import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { LocalStorage } from "./local-storage";
import { S3Storage } from "./s3-storage";
import type { Storage } from "./types";

export type { Storage, StoragePutResult, SignedUrlOptions } from "./types";
export { LocalStorage } from "./local-storage";
export { S3Storage } from "./s3-storage";

/** Match the session secret guard — 32 bytes is the OWASP HMAC minimum. */
const MIN_SIGNING_SECRET_LENGTH = 32;

function req(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`${name} must be set for the chosen STORAGE_PROVIDER.`);
  }
  return v;
}

function build(): Storage {
  const provider = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();

  // `local` needs the HMAC secret for our signed /api/files URLs; S3-family
  // providers don't. Only require it when the local backend is actually in use.
  if (provider === "local") {
    const root = process.env.STORAGE_LOCAL_ROOT ?? "./storage";
    const signingSecret = process.env.STORAGE_SIGNING_SECRET;
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    if (!signingSecret || signingSecret.length < MIN_SIGNING_SECRET_LENGTH) {
      throw new Error(
        `STORAGE_SIGNING_SECRET must be set to at least ${MIN_SIGNING_SECRET_LENGTH} characters.`,
      );
    }
    return new LocalStorage(root, signingSecret, appUrl);
  }

  // "s3" = AWS S3 (no endpoint override); "do-spaces" = DigitalOcean Spaces
  // (endpoint required). "r2" + others that are S3-compatible can alias
  // "s3" and set their own endpoint. We accept all three provider strings so
  // ops teams can be explicit in their env files.
  if (provider === "s3" || provider === "do-spaces" || provider === "r2") {
    const bucket = req("S3_BUCKET");
    const region = req("S3_REGION");
    const accessKeyId = req("S3_ACCESS_KEY");
    const secretAccessKey = req("S3_SECRET_KEY");
    // Endpoint: required for DO Spaces + R2, optional for AWS. Always pass
    // through when set so self-hosted S3-compatibles (MinIO for dev) also work.
    const endpoint = process.env.S3_ENDPOINT || undefined;
    // DO Spaces + MinIO default to virtual-hosted URLs; MinIO dev setups
    // sometimes need path-style addressing. Opt in via env.
    const forcePathStyle =
      (process.env.S3_FORCE_PATH_STYLE ?? "").toLowerCase() === "true";
    const client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });
    return new S3Storage(client, bucket);
  }

  throw new Error(
    `Unknown STORAGE_PROVIDER "${provider}". Supported: "local" (default), "s3", "do-spaces", "r2".`,
  );
}

let singleton: Storage | null = null;
export function storage(): Storage {
  if (!singleton) singleton = build();
  return singleton;
}

/**
 * Compose a storage key for an assignment-file upload. Keeps path layout
 * consistent across callers so a future reindex/backfill can walk the tree.
 *
 *   assignments/{assignmentId}/{lane}/{fileId}-{safeOriginalName}
 */
export function makeAssignmentFileKey(opts: {
  assignmentId: string;
  lane: "freelancer" | "realtor";
  fileId: string;
  originalName: string;
}): string {
  const safe = opts.originalName
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
  return `assignments/${opts.assignmentId}/${opts.lane}/${opts.fileId}-${safe}`;
}

/**
 * Compose an avatar storage key. Ext is one of the AVATAR_ALLOWED_EXTS —
 * stored in the key so the serving route can recover the MIME type without
 * an extra DB column.
 *
 *   avatars/{userId}/{version}.{ext}
 *
 * The `version` segment is a millisecond epoch stamp generated at upload
 * time — rotating it on each upload busts any in-flight caches of the
 * previous avatar (the user cookie points at the new key via
 * `User.avatarUrl` after the swap).
 */
export function makeAvatarKey(opts: {
  userId: string;
  version: string;
  ext: string;
}): string {
  return `avatars/${opts.userId}/${opts.version}.${opts.ext}`;
}

/**
 * Compose a team-branding storage key (logo or signature). Same versioning
 * convention as avatars — the epoch-ms version in the path lets the serving
 * route's `?v=` cache-bust work and lets us safely hard-delete the old file
 * on re-upload without racing the user's browser cache.
 *
 *   teams/{teamId}/{kind}/{version}.{ext}
 */
export function makeTeamBrandingKey(opts: {
  teamId: string;
  kind: "logo" | "signature";
  version: string;
  ext: string;
}): string {
  return `teams/${opts.teamId}/${opts.kind}/${opts.version}.${opts.ext}`;
}

/**
 * Build a stable, deterministic prefix for an assignment's files. Useful
 * when an entire assignment is being deleted and we want to fan-out the
 * storage cleanup via `deleteMany(filesUnderPrefix)`.
 */
export function assignmentFilePrefix(assignmentId: string): string {
  return `assignments/${assignmentId}/`;
}
