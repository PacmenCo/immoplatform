// Pins the test environment BEFORE any test module imports.
// Loaded via `vitest.config.ts#test.setupFiles` so it runs once per fork,
// ahead of any user `import`. Adjust via `vi.stubEnv(...)` inside a test
// if you need to exercise a specific env code path.

// Postgres target for tests. Assumes an `immo_test` database exists on
// localhost:5432 (see README: `brew install postgresql@16` or
// `docker compose up -d`). The harness in db.ts runs `prisma migrate
// deploy` on first use, then TRUNCATE between tests — no per-run
// schema push, so the connection string is stable across runs.
//
// Worker isolation: with vitest's forks pool we run multiple test files in
// parallel. Each worker gets its own Postgres SCHEMA inside the same
// `immo_test` database — schemas are cheap, and Prisma migrate deploy
// targets whatever `?schema=` says in DATABASE_URL. Worker 1 keeps the
// `public` schema (so a single-fork local run / CI works unchanged); higher
// pool ids land in `test_wN`. db.ts CREATEs the schema on first call.
// CI overrides DATABASE_URL via .github/workflows/test.yml.
const poolId = process.env.VITEST_POOL_ID ?? "1";
const schema = poolId === "1" ? "public" : `test_w${poolId}`;
process.env.TEST_DB_SCHEMA = schema;
process.env.DATABASE_URL ??=
  `postgresql://rl@localhost:5432/immo_test?schema=${schema}`;

// Local storage provider: tests exercise the real upload path (bytes land on
// disk, storage keys get signed). A separate tmp dir per fork gives each
// run a clean slate. The signing secret only needs to clear the 32-char
// OWASP HMAC minimum enforced in src/lib/storage/index.ts — the actual value
// is irrelevant since we never verify signatures in-process.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const testStorageDir = mkdtempSync(join(tmpdir(), "immo-test-storage-"));
process.env.STORAGE_PROVIDER ??= "local";
process.env.STORAGE_LOCAL_ROOT ??= testStorageDir;
process.env.STORAGE_SIGNING_SECRET ??=
  "test-signing-secret-not-for-production-use-0123456789";
process.env.APP_URL ??= "http://localhost:3000";

// Email dispatcher logs to console instead of sending. Matches the default
// behavior of src/lib/email.tsx when EMAIL_PROVIDER is unset or "dev".
process.env.EMAIL_PROVIDER ??= "dev";
process.env.EMAIL_FROM ??= "noreply@immo.test";

// Short-circuit calendar sync so tests never hit Google / Outlook.
// Gate is implemented at the top of src/lib/calendar/sync.ts.
process.env.SKIP_CALENDAR_SYNC ??= "1";

// Same short-circuit for Odoo sync — assignment-create tests exercise the
// Prisma path; a real Odoo round-trip would slow them down + flake on
// network. Individual tests opt back in by setting this to "0" + mocking
// `executeKw` from src/lib/odoo.
process.env.SKIP_ODOO_SYNC ??= "1";

// AES-256-GCM key for the calendar-token cipher (src/lib/calendar/crypto.ts)
// AND the HMAC secret for OAuth state cookies (src/lib/calendar/oauth.ts).
// requireEncryptionKey() decodes base64 → 32 bytes; this is
// `Buffer.alloc(32, 0xab).toString("base64")` — a deterministic, obviously-
// fake key that we'd never confuse for a production one.
process.env.CALENDAR_ENCRYPTION_KEY ??=
  "q6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6s=";

// Cron Bearer — used by /api/cron/* routes. Tests sign their requests
// with this value via the authorizeBearerToken helper.
process.env.CRON_SECRET ??= "test-cron-secret";

// Tests treat themselves as "behind a trusted proxy" — the rate-limit suite
// asserts XFF is parsed, and integration tests pass a forwarded header to
// drive per-IP buckets. Production opts in via the same env var.
process.env.TRUST_PROXY ??= "1";

// Base URL for absolute-URL helpers (email templates, calendar links).
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";

// NODE_ENV is set to "test" by Vitest automatically — don't reassign here,
// Next's TS types mark it read-only.

// bcrypt cost knob — production runs at 12, but tests churn through hundreds of
// hashes (every realtor/admin/freelancer fixture, every login/change-password
// path). Cost 4 is roughly 80× faster than 12 and shaves >10s off the suite.
// `hashPassword` in src/lib/auth.ts only honors this when NODE_ENV === "test".
process.env.BCRYPT_COST ??= "4";
