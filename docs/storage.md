# File storage

Immo uses a small `Storage` abstraction (`src/lib/storage/types.ts`) with
three implementations selected at runtime:

| Provider       | Use            | Where files live          |
|----------------|----------------|---------------------------|
| `local`        | dev / tests    | `./storage/` on disk      |
| `s3`           | prod on AWS    | AWS S3 bucket             |
| `do-spaces`    | prod on DO     | DigitalOcean Space        |
| `r2`           | prod on CF     | Cloudflare R2 bucket      |

All three implement the same interface: `put` / `delete` / `deleteMany` /
`exists` / `getSignedUrl`. Swapping is an env-var flip — no code changes.

## Local dev (default)

```
STORAGE_PROVIDER=local
STORAGE_LOCAL_ROOT=./storage              # default
STORAGE_SIGNING_SECRET=<32+ char secret>  # required — signs /api/files URLs
APP_URL=http://localhost:3000             # used to build absolute signed URLs
```

Bytes live under `./storage/`. Downloads go through `/api/files/*` which
HMAC-verifies the URL signature, looks up the original filename in the DB,
and streams the bytes back with a correct `Content-Disposition`.

## Cutting over to DigitalOcean Spaces

### One-time setup (in the DO panel)

1. **Create a Space.** Spaces → Create Space. Pick a region close to your
   users — typical European choice is `fra1` (Frankfurt) or `ams3`
   (Amsterdam). File listing: "Restrict file listing". CDN: off by default
   (can be enabled later).
2. **Generate access keys.** API → Spaces Keys → Generate New Key. Save
   the access key + secret key somewhere safe — the secret is shown once.
3. **Get the endpoint URL.** Your region appears in the Space's URL, e.g.
   `https://fra1.digitaloceanspaces.com`. Bucket name is the Space name.

### App config

Set these five env vars at the deploy target:

```
STORAGE_PROVIDER=do-spaces
S3_BUCKET=immo-prod-files
S3_REGION=fra1
S3_ENDPOINT=https://fra1.digitaloceanspaces.com
S3_ACCESS_KEY=<spaces key>
S3_SECRET_KEY=<spaces secret>
```

`STORAGE_SIGNING_SECRET` is unused in this mode but harmless to leave.

### Verify with the smoke script

```
S3_BUCKET=... S3_REGION=... S3_ACCESS_KEY=... \
  S3_SECRET_KEY=... S3_ENDPOINT=... STORAGE_PROVIDER=do-spaces \
  npx tsx scripts/storage-smoke.ts
```

The script uploads a small test object, verifies it's there, fetches it
via a presigned URL, batch-deletes, and re-verifies absence. Exit 0 =
bucket is wired. Exit non-zero prints which step failed.

### Migrating existing local files

The Prisma storage keys are just relative paths. Under local storage they
map to filesystem paths; under DO Spaces they map to object keys. Same keys,
different backend — no DB migration needed.

Two options for the actual bytes:

**Option A — copy then flip (zero-downtime).** Use `s3cmd` or `rclone` to
mirror `./storage/` into the Space, then flip the env vars on next deploy.
Users never lose access to old files.

```
# Example with s3cmd (needs .s3cfg configured with DO endpoint)
s3cmd sync --recursive ./storage/ s3://immo-prod-files/
```

**Option B — start fresh.** Flip env vars; old local files 404 on download.
Only acceptable if the current files are test data.

### Local S3 testing (MinIO)

To rehearse the S3 path without touching DO:

```
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minio -e MINIO_ROOT_PASSWORD=minio12345 \
  minio/minio server /data --console-address ":9001"
```

Console at <http://localhost:9001>, create a bucket named `immo-dev`.
Then:

```
STORAGE_PROVIDER=s3
S3_BUCKET=immo-dev
S3_REGION=us-east-1
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio12345
S3_FORCE_PATH_STYLE=true      # MinIO default addressing
```

Run `scripts/storage-smoke.ts` or start the dev server and test uploads
through the real UI. Disposable — kill the container when done.

## What's NOT configured in code

- **Lifecycle rules** (auto-expire old versions, archive cold files) —
  configure via the DO Spaces console or AWS lifecycle policies.
- **CORS** — only matters if we add browser-side direct uploads. We proxy
  via server today; no CORS needed.
- **CDN origin** — optional DO Spaces offering. If enabled, set the
  public CDN URL as `S3_ENDPOINT` to serve cached avatars faster. Our
  code doesn't care.
- **Virus scanning** — separate service. MIME sniffing is a CC todo.
- **Multipart uploads** — not needed until single files exceed ~100 MB.
  S3 `PutObject` accepts up to 5 GB single-shot.

## Operational notes

- **Signed URL TTL**: file downloads use 5 min (`DOWNLOAD_URL_TTL_SEC`);
  avatar redirects use 1 hour. Both well under AWS's 7-day max.
- **`exists()` cost**: DO charges the same for HEAD as GET; use
  sparingly on hot paths.
- **Avatar bytes**: on S3, served via 302 redirect to a presigned URL.
  Browser caches the redirect decision 5 min; the bytes follow DO's own
  cache headers (default: private, no-cache).
