import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { authorizeBearerToken } from "@/lib/cron-auth";
import { storage } from "@/lib/storage";

/**
 * Hard-deletes AssignmentFile rows + S3 bytes for files that were soft-
 * deleted more than `olderThanDays` ago (default 30). v1 parity:
 * Platform's destroyFile / destroyMakelaarFile delete the S3 object
 * synchronously inline (AssignmentController.php:921). v2 introduced
 * `deletedAt` for audit + undo affordance, which means a reaper has to
 * close the loop or the bucket bloats indefinitely.
 *
 * Authorisation: `Bearer CRON_SECRET` — same pattern as the other crons.
 *
 * Query params:
 *   `?dry=1`             — list what would be reaped, no writes.
 *   `?olderThanDays=N`   — override the 30-day default. Floored at 1 to
 *                          keep an accidental call from wiping fresh trash.
 *
 * Single batch per call: caps at MAX_PER_RUN to bound the blast radius if
 * something goes wrong. The cron schedule (hourly / nightly / whatever)
 * sets the actual throughput. S3 DeleteObjects can do 1000 keys per
 * round-trip so MAX_PER_RUN is set well below that ceiling.
 *
 * Failure semantics: storage.deleteMany failure → 500 with no DB write
 * and no audit, so the next tick retries against the same candidate set.
 * Storage.deleteMany itself swallows per-key NoSuchKey (file already gone)
 * so a previous run that bytes-deleted-but-DB-failed converges on retry.
 */

export const dynamic = "force-dynamic";

/** Hard cap per cron tick. The DO Spaces DeleteObjects ceiling is 1000;
 *  we sit well below so a slow batch can't saturate the cron timeout. */
const MAX_PER_RUN = 500;
const DEFAULT_OLDER_THAN_DAYS = 30;

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

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";
  const olderThanRaw = Number(url.searchParams.get("olderThanDays"));
  const olderThanDays = Number.isFinite(olderThanRaw) && olderThanRaw >= 1
    ? Math.floor(olderThanRaw)
    : DEFAULT_OLDER_THAN_DAYS;
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const candidates = await prisma.assignmentFile.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, storageKey: true },
    orderBy: { deletedAt: "asc" },
    take: MAX_PER_RUN,
  });

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      cutoff: cutoff.toISOString(),
      olderThanDays,
      found: 0,
      reaped: 0,
    });
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      cutoff: cutoff.toISOString(),
      olderThanDays,
      found: candidates.length,
      ids: candidates.map((c) => c.id),
    });
  }

  // Storage delete first, DB delete second. If storage fails we abort
  // before the DB delete so the rows stay around for the next tick to
  // retry — coupling the two halves prevents stranded bytes. If the DB
  // delete fails after storage succeeded, the next tick's storage delete
  // is a NoSuchKey no-op and the DB delete retries.
  try {
    await storage().deleteMany(candidates.map((c) => c.storageKey));
  } catch (err) {
    console.warn("reap: storage.deleteMany failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Storage cleanup failed; rows retained for retry.",
        found: candidates.length,
        reaped: 0,
      },
      { status: 500 },
    );
  }

  const ids = candidates.map((c) => c.id);
  const { count } = await prisma.assignmentFile.deleteMany({
    where: { id: { in: ids } },
  });

  // Skip the audit when count = 0. Two cron runs racing the same candidate
  // set both succeed at storage delete (idempotent) but only one wins the
  // DB delete; the loser's audit would say "I reaped these N files" with
  // zero matched rows, which is misleading.
  if (count > 0) {
    await audit({
      verb: "assignment.files_reaped",
      objectType: "assignment_file",
      metadata: {
        cutoff: cutoff.toISOString(),
        olderThanDays,
        reaped: count,
        fileIds: ids,
        trigger: "cron",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    cutoff: cutoff.toISOString(),
    olderThanDays,
    found: candidates.length,
    reaped: count,
  });
}
