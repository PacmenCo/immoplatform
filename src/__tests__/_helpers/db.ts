import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach } from "vitest";

/**
 * Test Prisma client for the parity suite. Targets the `immo_test`
 * Postgres database from `env.ts`.
 *
 * Lifecycle:
 *   - `resetDb()` first call: applies pending migrations via
 *     `prisma migrate deploy` so a fresh DB (dev box or CI container)
 *     auto-bootstraps. Subsequent calls: `TRUNCATE ... RESTART IDENTITY
 *     CASCADE` — millisecond-fast, handles FK fan-out automatically.
 *   - `setupTestDb()` wires the hooks into every test file.
 */

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "" } },
  log: [],
});

let schemaApplied = false;
let cachedTables: string[] | null = null;

// Per-worker schema name (set in env.ts). Worker 1 → "public"; workers >1
// → "test_wN". TRUNCATE + table discovery is scoped to this schema so
// parallel workers can't see each other's rows.
const TEST_SCHEMA = process.env.TEST_DB_SCHEMA ?? "public";

// Postgres identifiers must be double-quoted in DDL when interpolated.
// We control the value (env.ts builds it from VITEST_POOL_ID), so a basic
// shape check is enough — refuse anything that isn't a-z0-9_ to keep the
// `TRUNCATE ... ${quoted}` raw-SQL path safe.
if (!/^[a-z_][a-z0-9_]*$/i.test(TEST_SCHEMA)) {
  throw new Error(`Invalid TEST_DB_SCHEMA: ${TEST_SCHEMA}`);
}
const QUOTED_SCHEMA = `"${TEST_SCHEMA}"`;

async function fetchTableNames(): Promise<string[]> {
  // pg_catalog query — skip Prisma's own `_prisma_migrations` table.
  // Scoped to the worker's schema so the TRUNCATE list is exactly the
  // rows this worker owns.
  const rows = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = $1 AND tablename NOT LIKE '_prisma_%'`,
    TEST_SCHEMA,
  );
  return rows.map((r) => r.tablename);
}

export async function resetDb(opts?: { force?: boolean }): Promise<void> {
  // Second-and-beyond calls within this fork: cheap TRUNCATE.
  // Postgres's `TRUNCATE ... CASCADE` handles FK dependencies in one shot
  // (unlike SQLite's need for `PRAGMA foreign_keys = OFF`).
  if (schemaApplied && !opts?.force) {
    if (!cachedTables) cachedTables = await fetchTableNames();
    if (cachedTables.length === 0) return;
    const quoted = cachedTables
      .map((t) => `${QUOTED_SCHEMA}."${t}"`)
      .join(", ");
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
    );
    return;
  }

  // First call this fork: ensure the worker's schema exists, then apply
  // pending migrations. CREATE SCHEMA is idempotent and runs on the
  // existing connection (schemas are just namespaces; the DB itself must
  // already exist — see env.ts comment). Then `prisma migrate deploy`
  // targets the schema named in DATABASE_URL's `?schema=` param.
  // On a dev box with an already-migrated schema, migrate is a no-op that
  // takes ~200ms (Prisma checks + prints "No pending migrations").
  await prisma.$executeRawUnsafe(
    `CREATE SCHEMA IF NOT EXISTS ${QUOTED_SCHEMA}`,
  );
  await prisma.$disconnect();
  execFileSync(
    "npx",
    ["prisma", "migrate", "deploy"],
    { env: process.env, stdio: "pipe" },
  );
  await prisma.$connect();
  cachedTables = await fetchTableNames();
  // Make sure the schema is empty before the first test (leftovers from a
  // prior run shouldn't leak into assertions).
  if (cachedTables.length > 0) {
    const quoted = cachedTables
      .map((t) => `${QUOTED_SCHEMA}."${t}"`)
      .join(", ");
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
    );
  }
  schemaApplied = true;
}

/**
 * Wire the standard DB lifecycle into a test file:
 *   - `resetDb` before every test (fresh baseline for isolation)
 *   - `disconnectDb` once after the last test
 *
 * Placing the hooks at file scope (not inside a `describe`) avoids a
 * sibling-describe ordering bug where `disconnectDb` fires between
 * describe blocks and the next `resetDb` hits a closed DB. Call once
 * per test file:
 *
 *   import { setupTestDb } from "../_helpers/db";
 *   setupTestDb();
 */
export function setupTestDb(): void {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await disconnectDb();
  });
}

/**
 * Close the test client cleanly. No tmp dir to remove — the test DB is a
 * long-lived Postgres database reused across runs.
 */
export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Extract a strongly-typed-enough view of an `AuditLog.metadata` JsonValue.
 * The column holds JSONB and comes back as `Prisma.JsonValue`; our writers
 * always pass object shapes, so the runtime shape is an object. Collapses
 * null to `{}` so `.someKey` access on a non-existent metadata behaves
 * like a missing key rather than a TypeError.
 */
export function auditMeta(
  meta: unknown,
): Record<string, unknown> {
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
    return {};
  }
  return meta as Record<string, unknown>;
}
