import "server-only";
import { LocalStorage } from "./local-storage";
import type { Storage } from "./types";

export type { Storage, StoragePutResult } from "./types";
export { LocalStorage } from "./local-storage";

/** Match the session secret guard — 32 bytes is the OWASP HMAC minimum. */
const MIN_SIGNING_SECRET_LENGTH = 32;

function build(): Storage {
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  const signingSecret = process.env.STORAGE_SIGNING_SECRET;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  if (!signingSecret || signingSecret.length < MIN_SIGNING_SECRET_LENGTH) {
    throw new Error(
      `STORAGE_SIGNING_SECRET must be set to at least ${MIN_SIGNING_SECRET_LENGTH} characters.`,
    );
  }

  if (provider === "local") {
    const root = process.env.STORAGE_LOCAL_ROOT ?? "./storage";
    return new LocalStorage(root, signingSecret, appUrl);
  }

  throw new Error(
    `Unknown STORAGE_PROVIDER "${provider}". Implement src/lib/storage/${provider}-storage.ts and wire it here.`,
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
