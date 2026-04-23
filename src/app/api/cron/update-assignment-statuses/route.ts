import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { authorizeBearerToken } from "@/lib/cron-auth";

/**
 * Platform parity of `assignments:update-statuses` (app/Console/Commands/
 * UpdateAssignmentStatuses.php, scheduled hourly in routes/console.php:12).
 *
 * Promotes assignments from `scheduled` → `in_progress` once their
 * `preferredDate` has passed. Platform mapping: Ingepland → In verwerking,
 * actual_date → preferredDate.
 *
 * Per-row claim-then-update prevents a parallel cron run (e.g. Vercel
 * retries a timeout) from double-counting: `updateMany` with the
 * `status: "scheduled"` predicate returns `count: 0` on the second pass.
 *
 * Authorisation: `Bearer CRON_SECRET` — same pattern as invoice-reminder.
 *
 * `?dry=1` lists what would change without writing. No side effects.
 */

export const dynamic = "force-dynamic";

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

  const dryRun = new URL(req.url).searchParams.get("dry") === "1";
  const now = new Date();

  const candidates = await prisma.assignment.findMany({
    where: {
      status: "scheduled",
      preferredDate: { not: null, lt: now },
    },
    select: { id: true, preferredDate: true },
  });

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      found: candidates.length,
      ids: candidates.map((c) => c.id),
    });
  }

  const transitioned: Array<{ id: string; preferredDate: Date }> = [];
  for (const c of candidates) {
    if (!c.preferredDate) continue;
    const r = await prisma.assignment.updateMany({
      where: { id: c.id, status: "scheduled" },
      data: { status: "in_progress" },
    });
    if (r.count === 1) {
      transitioned.push({ id: c.id, preferredDate: c.preferredDate });
    }
  }

  for (const t of transitioned) {
    await audit({
      verb: "assignment.started",
      objectType: "assignment",
      objectId: t.id,
      metadata: {
        from: "scheduled",
        to: "in_progress",
        preferredDate: t.preferredDate.toISOString(),
        trigger: "cron",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    found: candidates.length,
    updated: transitioned.length,
    ids: transitioned.map((t) => t.id),
  });
}

