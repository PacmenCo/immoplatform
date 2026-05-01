import { beforeEach, describe, expect, it } from "vitest";
import { markAssignmentDelivered } from "@/app/actions/assignments";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";
import { __resetRequestContext, __setCookie } from "../_helpers/next-headers-stub";

// v1 parity — `Platform/app/Http/Controllers/AssignmentController.php:1066-1077`.
// markFinished was a single-route toggle on `finished_at`. v2 splits the
// agency-confirmation step out into markAssignmentCompleted, but the
// in_progress ↔ delivered edge must remain reversible — same UX.

setupTestDb();

beforeEach(() => {
  __resetRequestContext();
});

describe("markAssignmentDelivered — toggle (v1 parity)", () => {
  it("in_progress → delivered (forward direction sets timestamp)", async () => {
    const { admin, freelancer, teams } = await seedBaseline();
    __setCookie("immo_session", admin.id);
    const asg = await seedAssignment({
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      status: "in_progress",
    });
    const before = await prisma.assignment.findUniqueOrThrow({ where: { id: asg.id } });
    expect(before.deliveredAt).toBeNull();

    const res = await markAssignmentDelivered(asg.id);
    expect(res).toEqual({ ok: true });

    const after = await prisma.assignment.findUniqueOrThrow({ where: { id: asg.id } });
    expect(after.status).toBe("delivered");
    expect(after.deliveredAt).toBeInstanceOf(Date);
  });

  it("delivered → in_progress (toggle back nulls the timestamp)", async () => {
    // The v1 parity case: a freelancer (or anyone with edit) can un-mark
    // their delivery if it was a mistake. Mirrors v1 where
    // markFinished(finished_at = null) was the un-mark path.
    const { admin, freelancer, teams } = await seedBaseline();
    __setCookie("immo_session", admin.id);
    const asg = await seedAssignment({
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      status: "delivered",
    });
    // Stamp a deliveredAt so the toggle has something to clear.
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { deliveredAt: new Date() },
    });

    const res = await markAssignmentDelivered(asg.id);
    expect(res).toEqual({ ok: true });

    const after = await prisma.assignment.findUniqueOrThrow({ where: { id: asg.id } });
    expect(after.status).toBe("in_progress");
    expect(after.deliveredAt).toBeNull();
  });

  it("completed → rejected (one-way gate, commission already applied)", async () => {
    // v2 deviation from v1: completed is a hard one-way state because
    // commission was applied at completion time. Reverting via this
    // toggle would silently bypass the un-completion path.
    const { admin, freelancer, teams } = await seedBaseline();
    __setCookie("immo_session", admin.id);
    const asg = await seedAssignment({
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      status: "completed",
      completedAt: new Date(),
    });

    const res = await markAssignmentDelivered(asg.id);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("errors.assignment.completedReverseRequiresAdmin");
    }
  });

  it("audit verb is `assignment.delivered` going forward, `assignment.undelivered` going back", async () => {
    const { admin, freelancer, teams } = await seedBaseline();
    __setCookie("immo_session", admin.id);
    const asg = await seedAssignment({
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      status: "in_progress",
    });

    await markAssignmentDelivered(asg.id);
    await markAssignmentDelivered(asg.id);

    const verbs = await prisma.auditLog.findMany({
      where: { objectType: "assignment", objectId: asg.id },
      orderBy: { at: "asc" },
      select: { verb: true },
    });
    expect(verbs.map((v) => v.verb)).toEqual([
      "assignment.delivered",
      "assignment.undelivered",
    ]);
  });
});
