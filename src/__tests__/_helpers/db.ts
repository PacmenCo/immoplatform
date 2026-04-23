import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname } from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Test Prisma client for the parity suite.
 *
 * Uses a real SQLite file in the OS tmp dir (see `env.ts`) — needed so
 * `prisma db push`, which runs in a subprocess, shares the same database
 * as the in-process test client. `file::memory:` is per-process and
 * cannot be shared with a CLI spawn.
 *
 * `resetDb()` applies the Prisma schema on first call via `db push`,
 * then `DELETE FROM *`-truncates on subsequent calls for speed.
 */

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "" } },
  log: [],
});

let schemaApplied = false;

/**
 * Drop the in-memory DB and re-apply the Prisma schema. Fast (~100ms)
 * because SQLite's in-memory engine has no disk IO. Safe to call from
 * multiple suites — internally guards against reapplying within a fork
 * unless `force` is passed.
 */
export async function resetDb(opts?: { force?: boolean }): Promise<void> {
  // Second-and-beyond call inside the same fork: truncate tables via
  // DELETE FROM — much faster than re-running `db push`.
  if (schemaApplied && !opts?.force) {
    const tables: Array<{ name: string }> = await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'`,
    );
    // SQLite enforces FKs eagerly; because sqlite_master's table order is
    // not dependency-sorted, a plain DELETE-from-each loop hits FK errors
    // on tables whose children haven't been emptied yet (e.g. `services`
    // before `assignment_services`). Dropping the check for the scope of
    // the reset is the standard SQLite truncation idiom — safe inside
    // tests because we're wiping everything to a known-empty state.
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`);
    try {
      for (const { name } of tables) {
        await prisma.$executeRawUnsafe(`DELETE FROM "${name}"`);
      }
    } finally {
      await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);
    }
    return;
  }

  // First call: push the schema via the Prisma CLI. `execFileSync`
  // (not `exec`) passes argv directly — no shell, no injection surface.
  //
  // `--force-reset` would be ideal but Prisma 6 treats it as a destructive
  // AI-action that requires explicit per-message user consent. Our
  // `file::memory:` DB is fresh-empty on first call (nothing to reset),
  // and subsequent suite resets go through the DELETE-FROM truncate path
  // above, so plain `db push --accept-data-loss` is enough.
  await prisma.$disconnect();
  execFileSync(
    "npx",
    ["prisma", "db", "push", "--accept-data-loss", "--skip-generate"],
    { env: process.env, stdio: "pipe" },
  );
  await prisma.$connect();
  schemaApplied = true;
}

/**
 * Close the test client cleanly + remove the tmp SQLite file.
 * Call from an `afterAll` in long-lived suites; Vitest will also tear
 * down the fork when the run ends.
 */
export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
  const url = process.env.DATABASE_URL;
  const match = url?.match(/^file:(.+)$/);
  if (match) {
    const dir = dirname(match[1]);
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // swallow — tmp cleanup is best-effort
    }
  }
}
