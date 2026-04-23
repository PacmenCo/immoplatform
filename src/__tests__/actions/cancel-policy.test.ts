import { describe, expect, it } from "vitest";
import { cancelAssignmentInner } from "@/app/actions/assignments";
import { prisma, setupTestDb } from "../_helpers/db";
import { makeSession } from "../_helpers/session";
import { seedAssignment, seedBaseline, seedTeam } from "../_helpers/fixtures";

// Platform parity — ports behavioral contract from:
//   Platform/app/Policies/AssignmentPolicy.php::cancel
//   Platform/database/seeders/StatusSeeder.php (role_status pivot)
//
// Cancel policy:
//   - admin / staff → always
//   - realtor → creator OR team-owner (owned teamId match)
//   - freelancer → never (must ask admin/staff to reassign)
//   - already-terminal rows cannot be cancelled

setupTestDb();

describe("cancelAssignmentInner — role gate", () => {
  it("admin can cancel any assignment", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_admin_cancels",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await cancelAssignmentInner(admin, asg.id);
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true, cancelledAt: true },
    });
    expect(after.status).toBe("cancelled");
    expect(after.cancelledAt).toBeInstanceOf(Date);
  });

  it("staff can cancel any assignment", async () => {
    const { staff, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_staff_cancels",
      status: "in_progress",
      teamId: teams.t1.id,
    });
    const res = await cancelAssignmentInner(staff, asg.id);
    expect(res).toEqual({ ok: true });
  });

  it("freelancer CANNOT cancel, even their own assignment", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_freelancer_denied",
      status: "in_progress",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
    });
    const res = await cancelAssignmentInner(freelancer, asg.id);
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to cancel this.",
    });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true },
    });
    expect(after.status).toBe("in_progress");
  });

  it("realtor CAN cancel an assignment they created", async () => {
    const { realtor, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_realtor_creator_cancels",
      status: "scheduled",
      teamId: teams.t1.id,
      createdById: realtor.user.id,
    });
    const res = await cancelAssignmentInner(realtor, asg.id);
    expect(res).toEqual({ ok: true });
  });

  it("realtor CAN cancel via team-owner path (didn't create, but owns the team)", async () => {
    const { realtor, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_team_owner_cancels",
      status: "scheduled",
      teamId: teams.t1.id, // realtor owns t1 (see seedBaseline)
      createdById: null,
    });
    const res = await cancelAssignmentInner(realtor, asg.id);
    expect(res).toEqual({ ok: true });
  });

  it("realtor CANNOT cancel a foreign team's assignment (not creator, not owner)", async () => {
    await seedBaseline();
    // A second realtor, on team t2 only — not a member of t1, not creator.
    await seedTeam("t_owned_by_other", "Other Realtor Team");
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_outsider_realtor",
      activeTeamId: "t_owned_by_other",
      membershipTeams: [{ teamId: "t_owned_by_other", teamRole: "owner" }],
    });
    const asg = await seedAssignment({
      id: "a_foreign_team",
      status: "scheduled",
      teamId: "t_test_1", // outsider is not on this team
      createdById: null,
    });
    const res = await cancelAssignmentInner(outsider, asg.id);
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to cancel this.",
    });
  });
});

describe("cancelAssignmentInner — state preconditions", () => {
  it("completed assignment → rejects with 'already completed' error", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_already_completed",
      status: "completed",
      teamId: teams.t1.id,
    });
    const res = await cancelAssignmentInner(admin, asg.id);
    expect(res).toEqual({
      ok: false,
      error: "This assignment is already completed.",
    });
  });

  it("cancelled assignment → rejects with 'already cancelled' error (idempotency guard)", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_already_cancelled",
      status: "cancelled",
      teamId: teams.t1.id,
    });
    const res = await cancelAssignmentInner(admin, asg.id);
    expect(res).toEqual({
      ok: false,
      error: "This assignment is already cancelled.",
    });
  });

  it("non-existent assignment → 'Assignment not found.'", async () => {
    const { admin } = await seedBaseline();
    const res = await cancelAssignmentInner(admin, "a_ghost");
    expect(res).toEqual({ ok: false, error: "Assignment not found." });
  });
});

describe("cancelAssignmentInner — side effects", () => {
  it("persists the cancellation reason + writes a cancel comment", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_cancel_with_reason",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await cancelAssignmentInner(admin, asg.id, "Owner changed their mind");
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { cancellationReason: true },
    });
    expect(after.cancellationReason).toBe("Owner changed their mind");
    const comments = await prisma.assignmentComment.findMany({
      where: { assignmentId: asg.id },
      select: { body: true, authorId: true },
    });
    expect(comments).toHaveLength(1);
    expect(comments[0]).toEqual({
      body: "Cancelled: Owner changed their mind",
      authorId: admin.user.id,
    });
  });

  it("no reason → no comment row (clean audit trail)", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_cancel_no_reason",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    await cancelAssignmentInner(admin, asg.id);
    const comments = await prisma.assignmentComment.count({
      where: { assignmentId: asg.id },
    });
    expect(comments).toBe(0);
  });

  it("emits an assignment.cancelled audit entry with fromStatus metadata", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_cancel_audit",
      status: "in_progress",
      teamId: teams.t1.id,
    });
    await cancelAssignmentInner(admin, asg.id, "cleanup");
    const audit = await prisma.auditLog.findFirst({
      where: {
        actorId: admin.user.id,
        objectId: asg.id,
        verb: "assignment.cancelled",
      },
      select: { verb: true, metadata: true },
    });
    expect(audit).not.toBeNull();
    const meta = JSON.parse(audit?.metadata ?? "{}");
    expect(meta.fromStatus).toBe("in_progress");
    expect(meta.reason).toBe("cleanup");
  });
});
