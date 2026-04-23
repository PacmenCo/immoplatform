// Pins the test environment BEFORE any test module imports.
// Loaded via `vitest.config.ts#test.setupFiles` so it runs once per fork,
// ahead of any user `import`. Adjust via `vi.stubEnv(...)` inside a test
// if you need to exercise a specific env code path.

// Per-test-run SQLite file in the OS tmp dir. We use a real file (not
// `file::memory:`) so `prisma db push`, which runs in a subprocess, sees
// the same database as the in-process test client — `file::memory:` is
// scoped to a single process and can't be shared with a spawned CLI.
// Path includes a random suffix so parallel `npm test` invocations don't
// collide. The file is cleaned up by `disconnectDb()` in db.ts.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const testDbDir = mkdtempSync(join(tmpdir(), "immo-test-"));
process.env.DATABASE_URL ??= `file:${join(testDbDir, "test.db")}`;

// Local storage provider: tests exercise the real upload path (bytes land on
// disk, storage keys get signed). A separate tmp dir per fork mirrors the DB
// isolation strategy. The signing secret only needs to clear the 32-char
// OWASP HMAC minimum enforced in src/lib/storage/index.ts — the actual value
// is irrelevant since we never verify signatures in-process.
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

// Base URL for absolute-URL helpers (email templates, calendar links).
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";

// NODE_ENV is set to "test" by Vitest automatically — don't reassign here,
// Next's TS types mark it read-only.
