import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { authorizeBearerToken } from "@/lib/cron-auth";
import { syncAssignmentToOdoo } from "@/lib/odoo-sync";

/**
 * Sweep failed Odoo syncs and retry them. Replaces v1's queued-job retry
 * mechanism (`SyncAssignmentToOdoo $tries=2 + $backoff=30`) with a
 * cron-driven retry.
 *
 * Filter:
 *   - odooSyncedAt IS NULL          — green (synced) and amber (warning) rows are done
 *   - odooSyncError IS NOT NULL     — only previously-attempted-and-failed rows
 *   - odooSyncAttempts < 10         — hard cap; manual retry resets counter
 *   - updatedAt < now - 30 min      — cool-down so cron + in-flight create can't race
 *   - createdAt > now - 30 days     — outer time window; very old rows aren't worth retrying
 *
 * Authorisation: `Bearer CRON_SECRET` — same pattern as the other crons.
 *
 * Schedule: recommended hourly (matches other crons in this repo). The
 * 30-min cool-down means a single failed assignment retries roughly
 * twice an hour, capped at 10 attempts total — typically 5-10 hours of
 * outage before the row is permanently quarantined.
 *
 * Failure semantics: the orchestrator never throws (its own try/catch),
 * so per-row errors only surface in the response counts. Attempt counter
 * + sync-error column drive observability.
 */

export const dynamic = "force-dynamic";

const MAX_PER_RUN = 100;
const MAX_ATTEMPTS = 10;
const COOL_DOWN_MS = 30 * 60 * 1000;
const OUTER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }
  if (!authorizeBearerToken(req, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = Date.now();
  const cooldown = new Date(now - COOL_DOWN_MS);
  const horizon = new Date(now - OUTER_WINDOW_MS);

  const candidates = await prisma.assignment.findMany({
    where: {
      odooSyncedAt: null,
      odooSyncError: { not: null },
      odooSyncAttempts: { lt: MAX_ATTEMPTS },
      updatedAt: { lt: cooldown },
      createdAt: { gte: horizon },
    },
    select: { id: true, reference: true },
    orderBy: { updatedAt: "asc" },
    take: MAX_PER_RUN,
  });

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      attempted: 0,
      succeeded: 0,
      failed: 0,
    });
  }

  let succeeded = 0;
  let failed = 0;
  for (const c of candidates) {
    // The orchestrator catches its own errors. Defense-in-depth try/catch
    // so one row's catastrophic failure (e.g. Prisma connection drop)
    // doesn't abort the sweep and strand later candidates.
    try {
      await syncAssignmentToOdoo(c.id, { trigger: "cron" });
    } catch (err) {
      console.error(`[odoo-sync-retry] orchestrator threw unexpectedly for ${c.id}:`, err);
      failed++;
      continue;
    }
    // Re-read state to determine outcome — the orchestrator updates the
    // row's odooSyncedAt + odooSyncError directly.
    const row = await prisma.assignment.findUnique({
      where: { id: c.id },
      select: { odooSyncedAt: true, odooSyncError: true },
    });
    if (row?.odooSyncedAt && !row.odooSyncError) {
      succeeded++;
    } else {
      failed++;
    }
  }

  await audit({
    verb: "assignment.odoo_sync_retried",
    objectType: "assignment",
    metadata: {
      trigger: "cron",
      attempted: candidates.length,
      succeeded,
      failed,
      ids: candidates.map((c) => c.id),
    },
  });

  return NextResponse.json({
    ok: true,
    attempted: candidates.length,
    succeeded,
    failed,
  });
}
