import { describe, expect, it } from "vitest";
import {
  markAssignmentCompletedInner,
  reassignFreelancerInner,
} from "@/app/actions/assignments";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";

// Platform parity — ports behavioral contract from:
//   Platform/app/Http/Controllers/AssignmentController.php::markFinished
//   Platform/app/Http/Controllers/AssignmentController.php::assignFreelancer
//
// Covers:
//   markAssignmentCompleted:
//     - delivered → completed transition only
//     - commission applied in-tx (eligibility observed)
//     - "Marked completed: …" comment when note passed
//     - finishedAt override respected (no future dates)
//   reassignFreelancer:
//     - admin/staff only
//     - target must be an active freelancer
//     - terminal rows blocked
//     - audit emitted on flip

setupTestDb();

function form(data: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

describe("markAssignmentCompletedInner — happy path", () => {
  it("delivered + admin → completed + completedAt stamped + commission applied", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_complete_happy",
      status: "delivered",
      teamId: teams.t1.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    const res = await markAssignmentCompletedInner(admin, asg.id, undefined, form());
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true, completedAt: true },
    });
    expect(after.status).toBe("completed");
    expect(after.completedAt).toBeInstanceOf(Date);

    const commission = await prisma.assignmentCommission.findUnique({
      where: { assignmentId: asg.id },
      select: { commissionAmountCents: true },
    });
    expect(commission?.commissionAmountCents).toBe(3_750); // 15% of €250
  });

  it("finishedAt override → completedAt matches the submitted timestamp", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_complete_finishedat",
      status: "delivered",
      teamId: teams.t1.id,
    });
    const when = "2026-04-20T09:00:00.000Z";
    await markAssignmentCompletedInner(admin, asg.id, undefined, form({ finishedAt: when }));
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { completedAt: true },
    });
    expect(after.completedAt?.toISOString()).toBe(when);
  });

  it("note → writes a 'Marked completed: <note>' AssignmentComment", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_complete_with_note",
      status: "delivered",
      teamId: teams.t1.id,
    });
    await markAssignmentCompletedInner(
      admin,
      asg.id,
      undefined,
      form({ note: "Invoice generated offline." }),
    );
    const comments = await prisma.assignmentComment.findMany({
      where: { assignmentId: asg.id },
      select: { body: true, authorId: true },
    });
    expect(comments).toEqual([
      {
        body: "Marked completed: Invoice generated offline.",
        authorId: admin.user.id,
      },
    ]);
  });

  it("no note → no extra AssignmentComment row", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_complete_no_note",
      status: "delivered",
      teamId: teams.t1.id,
    });
    await markAssignmentCompletedInner(admin, asg.id, undefined, form());
    const count = await prisma.assignmentComment.count({
      where: { assignmentId: asg.id },
    });
    expect(count).toBe(0);
  });

  it("emits assignment.completed + assignment.commission_applied audit rows", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_complete_audit",
      status: "delivered",
      teamId: teams.t1.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    await markAssignmentCompletedInner(admin, asg.id, undefined, form());
    const audits = await prisma.auditLog.findMany({
      where: { actorId: admin.user.id, objectId: asg.id },
      orderBy: { at: "asc" },
      select: { verb: true },
    });
    const verbs = audits.map((a) => a.verb);
    expect(verbs).toContain("assignment.completed");
    expect(verbs).toContain("assignment.commission_applied");
  });
});

describe("markAssignmentCompletedInner — guard clauses", () => {
  it("not delivered (scheduled) → rejected", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_complete_not_delivered",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await markAssignmentCompletedInner(admin, asg.id, undefined, form());
    expect(res).toEqual({
      ok: false,
      error: "Only delivered assignments can be completed. This one is scheduled.",
    });
  });

  it("already completed → rejected", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_complete_already",
      status: "completed",
      teamId: teams.t1.id,
    });
    const res = await markAssignmentCompletedInner(admin, asg.id, undefined, form());
    expect(res).toEqual({
      ok: false,
      error: "Only delivered assignments can be completed. This one is completed.",
    });
  });

  it("finishedAt in the future → zod rejects", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_complete_future",
      status: "delivered",
      teamId: teams.t1.id,
    });
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const res = await markAssignmentCompletedInner(
      admin,
      asg.id,
      undefined,
      form({ finishedAt: future }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Finished-at can't be in the future/);
  });

  it("realtor NOT on the team → 'no permission' error", async () => {
    await seedBaseline();
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_outsider_complete",
      // no team memberships
    });
    const asg = await seedAssignment({
      id: "a_complete_outsider",
      status: "delivered",
      teamId: "t_test_1",
    });
    const res = await markAssignmentCompletedInner(outsider, asg.id, undefined, form());
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to complete this.",
    });
  });

  it("missing assignment → 'Assignment not found.'", async () => {
    const { admin } = await seedBaseline();
    const res = await markAssignmentCompletedInner(admin, "a_ghost", undefined, form());
    expect(res).toEqual({ ok: false, error: "Assignment not found." });
  });
});

describe("reassignFreelancerInner — role gate", () => {
  it("admin can reassign to an active freelancer", async () => {
    const { admin, freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_reassign_admin",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await reassignFreelancerInner(admin, asg.id, freelancer.user.id);
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { freelancerId: true },
    });
    expect(after.freelancerId).toBe(freelancer.user.id);
  });

  it("staff can reassign (Platform medewerker parity)", async () => {
    const { staff, freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_reassign_staff",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await reassignFreelancerInner(staff, asg.id, freelancer.user.id);
    expect(res).toEqual({ ok: true });
  });

  it("realtor rejected even when they own the team", async () => {
    const { realtor, freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_reassign_realtor",
      status: "scheduled",
      teamId: teams.t1.id,
      createdById: realtor.user.id,
    });
    const res = await reassignFreelancerInner(realtor, asg.id, freelancer.user.id);
    expect(res).toEqual({
      ok: false,
      error: "Only admins and staff can assign a freelancer.",
    });
  });

  it("freelancer rejected", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_reassign_freelancer_denied",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await reassignFreelancerInner(freelancer, asg.id, freelancer.user.id);
    expect(res).toEqual({
      ok: false,
      error: "Only admins and staff can assign a freelancer.",
    });
  });
});

describe("reassignFreelancerInner — state guards", () => {
  it("completed assignment → rejected", async () => {
    const { admin, freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_reassign_completed",
      status: "completed",
      teamId: teams.t1.id,
    });
    const res = await reassignFreelancerInner(admin, asg.id, freelancer.user.id);
    expect(res).toEqual({
      ok: false,
      error: "This assignment is completed and can't be reassigned.",
    });
  });

  it("cancelled assignment → rejected", async () => {
    const { admin, freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_reassign_cancelled",
      status: "cancelled",
      teamId: teams.t1.id,
    });
    const res = await reassignFreelancerInner(admin, asg.id, freelancer.user.id);
    expect(res).toEqual({
      ok: false,
      error: "This assignment is cancelled and can't be reassigned.",
    });
  });
});

describe("reassignFreelancerInner — target validation", () => {
  it("target not a freelancer (realtor) → 'not an active freelancer' error", async () => {
    const { admin, realtor, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_reassign_bad_target",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await reassignFreelancerInner(admin, asg.id, realtor.user.id);
    expect(res).toEqual({
      ok: false,
      error: "That user isn't an active freelancer.",
    });
  });

  it("target doesn't exist → 'not an active freelancer' error", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_reassign_missing_target",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await reassignFreelancerInner(admin, asg.id, "u_does_not_exist");
    expect(res).toEqual({
      ok: false,
      error: "That user isn't an active freelancer.",
    });
  });

  it("target is a soft-deleted freelancer → rejected", async () => {
    const { admin, freelancer, teams } = await seedBaseline();
    await prisma.user.update({
      where: { id: freelancer.user.id },
      data: { deletedAt: new Date() },
    });
    const asg = await seedAssignment({
      id: "a_reassign_deleted_target",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await reassignFreelancerInner(admin, asg.id, freelancer.user.id);
    expect(res).toEqual({
      ok: false,
      error: "That user isn't an active freelancer.",
    });
  });

  it("null target (unassign) is accepted", async () => {
    const { admin, freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_reassign_unassign",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
    });
    const res = await reassignFreelancerInner(admin, asg.id, null);
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { freelancerId: true },
    });
    expect(after.freelancerId).toBeNull();
  });
});

describe("reassignFreelancerInner — audit trail", () => {
  it("emits assignment.reassigned with freelancerId + previousFreelancerId metadata", async () => {
    const { admin, freelancer, teams } = await seedBaseline();
    const prior = await prisma.user.create({
      data: {
        id: "u_prior_freelancer",
        email: "prior@test.local",
        role: "freelancer",
        firstName: "Prior",
        lastName: "Freelancer",
      },
    });
    const asg = await seedAssignment({
      id: "a_reassign_audit",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: prior.id,
    });
    await reassignFreelancerInner(admin, asg.id, freelancer.user.id);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        actorId: admin.user.id,
        verb: "assignment.reassigned",
        objectId: asg.id,
      },
      select: { metadata: true },
    });
    const meta = auditMeta(audit.metadata);
    expect(meta.freelancerId).toBe(freelancer.user.id);
    expect(meta.previousFreelancerId).toBe(prior.id);
  });
});
