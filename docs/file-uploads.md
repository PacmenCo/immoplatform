# Assignment file uploads

Design notes + ops runbook for the `AssignmentFile` feature added in April 2026.

## What it does

Every assignment has two independent **file lanes**:

| Lane | Who uploads | Typical content | Size cap | Allowed MIME |
|---|---|---|---|---|
| `freelancer` | The assigned freelancer (+ admin/staff) | Final certificate PDFs, lab results | 50 MB / file | `application/pdf` |
| `realtor` | Team members of the assignment's team (+ admin/staff) | Floor plans, photos, access notes | 10 MB / file | `application/pdf`, `image/jpeg`, `image/png`, `image/webp` |

Both lanes are visible on the assignment's **Files** tab to anyone who can view the assignment — including the opposite side. A freelancer sees the realtor's floor plan; a realtor sees the freelancer's deliverable PDF. Uploads are blocked once the assignment reaches a terminal status (`completed` or `cancelled`).

## Architecture

```
┌─────────────────────────┐
│ Dashboard UI            │
│  files/page.tsx         │  Two-lane view + upload forms
│  FileUploadForm.tsx     │  Client form, Dropzone + useActionState
└────────┬────────────────┘
         │ useActionState
         ▼
┌─────────────────────────┐
│ Server actions          │
│  actions/files.ts       │  upload / delete / getSignedUrl
│   – withSession         │  auth + authz preamble
│   – policies from       │  canUploadToFreelancerLane, etc.
│     permissions.ts      │
└────────┬────────────────┘
         │ Storage interface
         ▼
┌─────────────────────────┐         ┌────────────────────┐
│ src/lib/storage/        │         │ src/app/api/files/  │
│  types.ts (interface)   │         │  [...path]/route.ts │
│  local-storage.ts (dev) │◄────────┤ HMAC verify + stream│
│  index.ts (factory)     │         │ (session-less)      │
└─────────────────────────┘         └────────────────────┘
```

### Key design decisions

1. **Server actions take `FormData` directly — no temp-staging layer.** Unlike Platform's FilePond dance, Next.js server actions accept multipart uploads natively. One round-trip does auth + validate + write.
2. **Lane as a column, not two tables.** Shared lifecycle, simpler "all files for assignment" queries. The `@@index([assignmentId, lane, deletedAt])` covers both per-lane listing and soft-delete filtering.
3. **Soft delete.** `deletedAt` lets us undelete accidental wipes and preserves audit integrity (`audit.objectId` still points at a real row). A future scheduled job can physically purge objects after a retention window.
4. **Local FS first, S3 behind an env flag.** The `Storage` interface is the portable boundary — UI + actions + policies know nothing about the backend. `LocalStorage` implements HMAC-signed download URLs; S3/DO Spaces would use the SDK's presigned URL scheme and bypass the `/api/files/...` route entirely.
5. **HMAC-signed download URLs with 5-minute TTL.** Matches Platform. The signed URL IS the authorization — no session lookup on the download path, which keeps it cacheable and lets users click-share within the TTL.
6. **Pre-generated file ids.** We generate the cuid before writing to storage so the `storageKey` path reflects the row id. A future reconcile job can walk the `./storage/` tree and pair orphans with rows unambiguously.
7. **Upload rollback on DB failure.** If the storage write succeeds but the transactional row insert fails, the stored bytes are deleted in the catch block — no orphaned objects.

## Storage path layout

```
${STORAGE_LOCAL_ROOT}/
  assignments/
    ${assignmentId}/
      freelancer/
        ${fileId}-${safeOriginalName}
      realtor/
        ${fileId}-${safeOriginalName}
```

`safeOriginalName` strips non-`[\w.\- ]` chars and caps at 120 chars. `fileId` is a cuid.

## Policy matrix

| Policy fn | Admin/staff | Realtor (owner OR team member OR creator) | Freelancer |
|---|---|---|---|
| `canUploadToFreelancerLane` | ✓ | ✗ | ✓ if `freelancerId === me` |
| `canUploadToRealtorLane` | ✓ | ✓ on own teams | ✗ |
| `canViewAssignmentFiles` | ✓ | ✓ | ✓ (both lanes) |
| `canDeleteAssignmentFile` | ✓ any | ✓ only own uploads | ✓ only own uploads |

All upload/delete paths additionally block when the assignment is terminal (unless the caller is admin/staff).

## Operational concerns

### Backups

`./storage/` is a plain directory tree. For a VPS deploy, rsync or a systemd-timer tar cronjob are sufficient. When we flip to S3, bucket versioning covers this.

### Cleanup of soft-deleted files

Not yet implemented. Recommended: a scheduled job that runs daily, finds `AssignmentFile` rows with `deletedAt < NOW() - 30 days`, calls `storage().delete(key)`, and hard-deletes the row. Out of scope for v1.

### Disk budget

With 10 MB avg per file and 20 files per assignment, 1 GB holds ~5,000 assignments' files. Monitor `/storage` mount; alert at 80%.

### MIME validation

Server-side re-checks MIME in `uploadAssignmentFiles` before writing. Client-side check is UX only. We do **not** sniff file contents (no `file-type` magic-byte detection yet) — a determined user can upload a `.exe` renamed to `.pdf`. Virus scanning (ClamAV) is a post-launch addition.

### Signing-secret rotation

`STORAGE_SIGNING_SECRET` is read once at startup (in `src/lib/storage/index.ts`'s `build()`). Rotating the secret invalidates every in-flight signed URL (5-min window). Safe to rotate at any time with minimal user impact.

## Swap to S3 / DigitalOcean Spaces / R2

1. Add `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.
2. Create `src/lib/storage/s3-storage.ts` implementing `Storage`:
   - `put` → `PutObjectCommand`
   - `getStream` → `GetObjectCommand` → body stream
   - `delete` → `DeleteObjectCommand`
   - `getSignedUrl` → presigner, 5-min TTL
3. Extend `src/lib/storage/index.ts`'s `build()` with an `"s3"` branch.
4. Set env:
   ```
   STORAGE_PROVIDER=s3
   S3_BUCKET=immo-files
   S3_REGION=fra1
   S3_ENDPOINT=https://fra1.digitaloceanspaces.com
   S3_ACCESS_KEY=...
   S3_SECRET_KEY=...
   ```
5. Delete `/api/files/[...path]/route.ts` — S3 presigned URLs hit the bucket directly. Nothing else changes: UI, actions, policies are untouched.

## Audit verbs

New entries in the `AuditVerb` union:

- `assignment.file_uploaded` — on each successful per-file write. Metadata: `{ assignmentId, lane, originalName, sizeBytes }`.
- `assignment.file_deleted` — on each soft-delete. Metadata: `{ assignmentId, originalName }`.

Downloads are **not audited** today to avoid log volume. Platform tracks `firstDownloadedAt` on the assignment for invoicing; port when the email provider lands.

## Explicit out-of-scope for v1

- Chunked / resumable uploads (Platform has none either)
- Virus scanning
- Email on upload (needs email provider)
- Auto-transition `delivered → completed` when freelancer uploads final deliverable (needs email)
- `firstDownloadedAt` tracking
- Physical cleanup of soft-deleted rows
- Team branding uploads (logo, signature) — reuses the abstraction, separate PR
- Avatar uploads — same
- Download audit log
- MIME magic-byte sniffing
