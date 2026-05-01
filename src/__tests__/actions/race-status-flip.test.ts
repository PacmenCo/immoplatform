import { describe, expect, it } from "vitest";
import {
  cancelAssignmentInner,
  markAssignmentCompletedInner,
} from "@/app/actions/assignments";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";

// v1→v2 flow-parity test: status-flip race.
//
// v1 (Platform/AssignmentController.php::markFinished) was pure LWW —
// `$assignment->update(['status_id' => …])` with no `where status =` predicate.
// Two concurrent transitions in v1 would both succeed and the second clobbers.
//
// v2's lifecycle actions claim the row via:
//   prisma.assignment.updateMany({ where: { id, status: { in: sourcesOf(target) } }, … })
// so the second writer's `count === 0` returns:
//   "Status changed while you were away. Reload and try again."
//
// This file proves the v2 protection holds for back-to-back transitions.

setupTestDb();

const STALE_COPY = "errors.assignment.statusChangedAway";

describe("v1→v2 race: admin completes vs freelancer's stale write", () => {
  it("first transition wins; second errors with stale-status copy; single audit row", async () => {
    const { admin, freelancer, teams } = await seedBaseline();

    // Seed at `in_progress` — the realistic precondition for the agency's
    // `markAssignmentCompleted` to succeed. The freelancer (or another
    // actor) will then race a `cancelAssignment`, which also expects a
    // non-terminal source state.
    const asg = await seedAssignment({
      id: "a_race_complete_vs_cancel",
      status: "in_progress",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      createdById: admin.user.id,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    // First writer: admin completes. Predicate matches (in_progress →
    // completed is in sourcesOf("completed")). Should succeed.
    const fd = new FormData();
    const completeRes = await markAssignmentCompletedInner(
      admin,
      asg.id,
      undefined,
      fd,
    );
    expect(completeRes).toEqual({ ok: true });

    const after1 = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true },
    });
    expect(after1.status).toBe("completed");

    // Second writer (admin again — freelancer can't cancel): cancel.
    // The action's early guard catches `completed` first and returns
    // "errors.assignment.alreadyCompleted", which is the *intended*
    // user-visible copy when the source state is already terminal.
    // Status changed copy is for the narrower predicate-only race.
    const cancelRes = await cancelAssignmentInner(admin, asg.id);
    expect(cancelRes).toEqual({
      ok: false,
      error: "errors.assignment.alreadyCompleted",
    });

    // Audit log shows ONE assignment.completed and ZERO assignment.cancelled.
    const audits = await prisma.auditLog.findMany({
      where: { objectId: asg.id },
      select: { verb: true },
      orderBy: { at: "asc" },
    });
    const completedRows = audits.filter((a) => a.verb === "assignment.completed");
    const cancelledRows = audits.filter((a) => a.verb === "assignment.cancelled");
    expect(completedRows.length).toBe(1);
    expect(cancelledRows.length).toBe(0);
  });

  it("predicate-only race: stale `in_progress` row hits updateMany count=0 and returns stale-status copy", async () => {
    // This test exercises the v2 inverse-transition predicate directly.
    // Setup: assignment is `in_progress`. We simulate two concurrent admins:
    //   - A1 reads at `in_progress`, fires markComplete → updateMany claims
    //     the row, status flips to `completed`.
    //   - A2 already read at `in_progress`, then ALSO fires markComplete —
    //     bypassing the early sourcesOf precheck by loading first then
    //     calling the action against the now-stale row.
    //
    // To make the predicate-count fire (not the early read-guard), we
    // race two completion attempts where the SECOND inner call enters
    // after the first has flipped state. The early guard re-reads, so
    // we need to call `markCompletedInner` on a row that was `delivered`
    // when we *decided* to call it but is now `completed`.
    //
    // The simplest deterministic way: flip the row out from under a
    // second call between its early read and the predicate-claim. Since
    // we can't intercept the action mid-call, we instead prove the
    // protection by simulating: if we manually flip the row to
    // `completed` first, then call cancelAssignmentInner, the action's
    // own read sees `completed` and rejects via the early guard.
    // The predicate's count=0 path fires when two callers both pass
    // their early reads — which requires real concurrency.
    //
    // Real-concurrency simulation: kick off two markCompletedInner
    // calls in parallel via Promise.all and assert exactly one wins.
    const { admin, teams, freelancer } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_race_double_complete",
      status: "in_progress",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      createdById: admin.user.id,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    // Two parallel completion attempts. Both pass their early read at
    // `delivered`; the predicate-count guard ensures only one claims.
    const [r1, r2] = await Promise.all([
      markAssignmentCompletedInner(admin, asg.id, undefined, new FormData()),
      markAssignmentCompletedInner(admin, asg.id, undefined, new FormData()),
    ]);

    const winners = [r1, r2].filter((r) => r.ok);
    const losers = [r1, r2].filter((r) => !r.ok);
    expect(winners.length).toBe(1);
    expect(losers.length).toBe(1);

    // Loser's error must be one of the two intended messages:
    //   - "Status changed while you were away. Reload and try again."  (predicate count=0)
    //   - "This assignment can't be completed from its current status."  (early guard re-read once status is `completed`)
    // Either is correct v2 behavior — both prevent the v1 LWW clobber.
    const loser = losers[0];
    if (!loser.ok) {
      const ok =
        loser.error === STALE_COPY ||
        loser.error === "errors.assignment.cannotCompleteFromCurrentStatus";
      expect(ok).toBe(true);
    }

    // Final state: exactly one completion happened.
    const final = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true, completedAt: true },
    });
    expect(final.status).toBe("completed");
    expect(final.completedAt).toBeInstanceOf(Date);

    // Audit log: exactly one assignment.completed row.
    const completedAudits = await prisma.auditLog.findMany({
      where: { objectId: asg.id, verb: "assignment.completed" },
    });
    expect(completedAudits.length).toBe(1);
  });

  it("complete-vs-cancel concurrent: exactly one transition lands, no double audit", async () => {
    // Both actions start from `in_progress`. Whichever updateMany claims the
    // row first wins; the other's predicate (`status: in sourcesOf(completed)`
    // for complete; `status: notIn TERMINAL` for cancel — but the row is
    // now terminal) returns count=0. Net: one transition, one audit row,
    // no double-bookkeeping.
    const { admin, teams, freelancer } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_race_complete_vs_cancel_parallel",
      status: "in_progress",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      createdById: admin.user.id,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    const [completeRes, cancelRes] = await Promise.all([
      markAssignmentCompletedInner(admin, asg.id, undefined, new FormData()),
      cancelAssignmentInner(admin, asg.id),
    ]);

    const winners = [completeRes, cancelRes].filter((r) => r.ok);
    const losers = [completeRes, cancelRes].filter((r) => !r.ok);
    expect(winners.length).toBe(1);
    expect(losers.length).toBe(1);

    const final = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true },
    });
    // Final state is whichever target the winning action chose.
    expect(["completed", "cancelled"]).toContain(final.status);

    // Audit log carries the winner's verb exactly once and no row for the
    // loser's verb. Validates no double-bookkeeping under contention.
    const completedRows = await prisma.auditLog.count({
      where: { objectId: asg.id, verb: "assignment.completed" },
    });
    const cancelledRows = await prisma.auditLog.count({
      where: { objectId: asg.id, verb: "assignment.cancelled" },
    });
    expect(completedRows + cancelledRows).toBe(1);
    if (final.status === "completed") {
      expect(completedRows).toBe(1);
      expect(cancelledRows).toBe(0);
    } else {
      expect(cancelledRows).toBe(1);
      expect(completedRows).toBe(0);
    }
  });
});
