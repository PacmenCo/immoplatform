/**
 * Storage smoke test — run against any configured backend to verify the
 * full put / exists / getSignedUrl / deleteMany round-trip.
 *
 * Usage:
 *
 *   # Local dev:
 *   STORAGE_PROVIDER=local STORAGE_SIGNING_SECRET=$(openssl rand -hex 32) \
 *     STORAGE_LOCAL_ROOT=./tmp_smoke npx tsx scripts/storage-smoke.ts
 *
 *   # DO Spaces:
 *   STORAGE_PROVIDER=do-spaces S3_BUCKET=immo-prod-files S3_REGION=fra1 \
 *     S3_ENDPOINT=https://fra1.digitaloceanspaces.com \
 *     S3_ACCESS_KEY=... S3_SECRET_KEY=... \
 *     npx tsx scripts/storage-smoke.ts
 *
 *   # Local MinIO:
 *   STORAGE_PROVIDER=s3 S3_BUCKET=immo-dev S3_REGION=us-east-1 \
 *     S3_ENDPOINT=http://localhost:9000 S3_ACCESS_KEY=minio \
 *     S3_SECRET_KEY=minio12345 S3_FORCE_PATH_STYLE=true \
 *     npx tsx scripts/storage-smoke.ts
 *
 * Exits 0 on full success; non-zero with a step name on the first failure.
 *
 * Note: this script intentionally bypasses `src/lib/storage/index.ts` so
 * it can run under bare tsx without Next's `server-only` shim. It mirrors
 * the factory's env-var parsing — keep the two in sync when adding providers.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { LocalStorage } from "../src/lib/storage/local-storage";
import { S3Storage } from "../src/lib/storage/s3-storage";
import type { Storage } from "../src/lib/storage/types";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set for the chosen STORAGE_PROVIDER.`);
  return v;
}

function buildStorage(): Storage {
  const provider = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  if (provider === "local") {
    const root = process.env.STORAGE_LOCAL_ROOT ?? "./storage";
    const signingSecret = process.env.STORAGE_SIGNING_SECRET;
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    if (!signingSecret || signingSecret.length < 32) {
      throw new Error("STORAGE_SIGNING_SECRET must be set to at least 32 characters.");
    }
    return new LocalStorage(root, signingSecret, appUrl);
  }
  if (provider === "s3" || provider === "do-spaces" || provider === "r2") {
    const bucket = req("S3_BUCKET");
    const region = req("S3_REGION");
    const accessKeyId = req("S3_ACCESS_KEY");
    const secretAccessKey = req("S3_SECRET_KEY");
    const endpoint = process.env.S3_ENDPOINT || undefined;
    const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE ?? "").toLowerCase() === "true";
    const client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });
    return new S3Storage(client, bucket);
  }
  throw new Error(`Unknown STORAGE_PROVIDER "${provider}".`);
}

async function main() {
  const store = buildStorage();
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  console.log(`[smoke] provider=${provider}`);

  const key = `_smoke/${randomUUID()}.txt`;
  const payload = Buffer.from(`hello from storage-smoke @ ${new Date().toISOString()}`);

  console.log(`[smoke] put ${key} (${payload.byteLength} bytes) …`);
  const putResult = await store.put(key, payload, { mimeType: "text/plain" });
  if (putResult.sizeBytes !== payload.byteLength) {
    throw new Error(`put returned sizeBytes=${putResult.sizeBytes}, expected ${payload.byteLength}`);
  }

  console.log(`[smoke] exists (expect true) …`);
  if (!(await store.exists(key))) {
    throw new Error("exists returned false immediately after put");
  }

  // Signed-URL fetch only works on S3-family backends in this script — the
  // LocalStorage URL points at /api/files/* which needs the Next dev server
  // running. Skip the fetch for local but still verify URL generation works.
  console.log(`[smoke] getSignedUrl …`);
  const url = await store.getSignedUrl(key, { ttlSec: 60, downloadName: "smoke.txt" });
  if (typeof url !== "string" || url.length === 0) {
    throw new Error("getSignedUrl returned an empty URL");
  }
  if (provider !== "local") {
    console.log(`[smoke] fetch via presigned URL …`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`signed-URL fetch failed: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    if (!text.startsWith("hello from storage-smoke")) {
      throw new Error(`fetched body looks wrong: ${text.slice(0, 100)}`);
    }
  }

  console.log(`[smoke] deleteMany …`);
  await store.deleteMany([key]);

  console.log(`[smoke] exists (expect false) …`);
  if (await store.exists(key)) {
    throw new Error("exists still returned true after deleteMany");
  }

  console.log(`[smoke] ✓ all checks passed`);
}

main().catch((err) => {
  console.error("[smoke] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
