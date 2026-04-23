import { describe, expect, it } from "vitest";
import { changeAssignmentStatusInner } from "@/app/actions/assignments";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";

// Platform parity — ports behavioral contract from:
//   Platform/app/Http/Controllers/AssignmentController.php::updateStatus (line 400+)
//   Platform/database/seeders/StatusSeeder.php (role_status pivot)
//
// changeAssignmentStatus enforces three layers, any of which can reject:
//   1) canRoleTransitionTo — role's allowlist for the TARGET status
//   2) canTransition — state-machine edge (draft → scheduled is legal, etc)
//   3) per-target permission gate — canCompleteAssignment for completed, etc
//
// These tests focus on layer 1 (role allowlist) + layer 3 (target policy).
// Layer 2 is exhaustively tested in src/__tests__/lib/status.test.ts.

setupTestDb();

describe("changeAssignmentStatusInner — role allowlist", () => {
  it("admin can set any target status", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_admin_sets_cancelled",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await changeAssignmentStatusInner(admin, asg.id, {
      to: "cancelled",
    });
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true, cancelledAt: true },
    });
    expect(after.status).toBe("cancelled");
    expect(after.cancelledAt).toBeInstanceOf(Date);
  });

  it("staff can set any target status (Platform medewerker parity)", async () => {
    const { staff, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_staff_sets_completed",
      status: "delivered",
      teamId: teams.t1.id,
    });
    const res = await changeAssignmentStatusInner(staff, asg.id, {
      to: "completed",
    });
    expect(res).toEqual({ ok: true });
  });

  it("freelancer CANNOT set status to cancelled (Platform role_status excludes it)", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_freelancer_cannot_cancel",
      status: "in_progress",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
    });
    const res = await changeAssignmentStatusInner(freelancer, asg.id, {
      to: "cancelled",
    });
    expect(res).toEqual({
      ok: false,
      error: "Your role can't set this status.",
    });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true },
    });
    expect(after.status).toBe("in_progress");
  });

  it("freelancer CANNOT set status to completed (that's the agency's action)", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_freelancer_cannot_complete",
      status: "delivered",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
    });
    const res = await changeAssignmentStatusInner(freelancer, asg.id, {
      to: "completed",
    });
    expect(res).toEqual({
      ok: false,
      error: "Your role can't set this status.",
    });
  });

  it("freelancer CAN set status to scheduled (allowed target)", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_freelancer_schedules",
      status: "awaiting",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
    });
    const res = await changeAssignmentStatusInner(freelancer, asg.id, {
      to: "scheduled",
    });
    expect(res).toEqual({ ok: true });
  });

  it("realtor CANNOT set status to completed", async () => {
    const { realtor, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_realtor_cannot_complete",
      status: "delivered",
      teamId: teams.t1.id,
      createdById: realtor.user.id,
    });
    const res = await changeAssignmentStatusInner(realtor, asg.id, {
      to: "completed",
    });
    expect(res).toEqual({
      ok: false,
      error: "Your role can't set this status.",
    });
  });

  it("realtor CAN set status to cancelled (it's on the allowlist)", async () => {
    const { realtor, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_realtor_cancels",
      status: "scheduled",
      teamId: teams.t1.id,
      createdById: realtor.user.id,
    });
    const res = await changeAssignmentStatusInner(realtor, asg.id, {
      to: "cancelled",
    });
    expect(res).toEqual({ ok: true });
  });

  it("same-status noop is always OK (form resubmit guard)", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_noop_same_status",
      status: "in_progress",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
    });
    const res = await changeAssignmentStatusInner(freelancer, asg.id, {
      to: "in_progress",
    });
    expect(res).toEqual({ ok: true });
  });
});

describe("changeAssignmentStatusInner — target-specific policy gates", () => {
  it("completion fires applyCommission when assignment is eligible", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_complete_with_commission",
      status: "delivered",
      teamId: teams.t1.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    const res = await changeAssignmentStatusInner(admin, asg.id, {
      to: "completed",
    });
    expect(res).toEqual({ ok: true });

    const row = await prisma.assignmentCommission.findUnique({
      where: { assignmentId: asg.id },
      select: { commissionAmountCents: true },
    });
    expect(row?.commissionAmountCents).toBe(3_750); // 15% of €250
  });

  it("leaving `completed` drops the commission line (when quarter not paid)", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_leave_completed",
      status: "completed",
      teamId: teams.t1.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    // Seed an existing commission line (as if it had been computed on completion).
    await prisma.assignmentCommission.create({
      data: {
        assignmentId: asg.id,
        teamId: teams.t1.id,
        assignmentTotalCents: 25_000,
        commissionType: "percentage",
        commissionValue: 1500,
        commissionAmountCents: 3_750,
      },
    });
    const res = await changeAssignmentStatusInner(admin, asg.id, {
      to: "awaiting",
    });
    expect(res).toEqual({ ok: true });
    const row = await prisma.assignmentCommission.findUnique({
      where: { assignmentId: asg.id },
    });
    expect(row).toBeNull();
  });

  it("leaving `completed` is BLOCKED when the quarter was already paid", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_leave_completed_paid",
      status: "completed",
      teamId: teams.t1.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    const computedAt = new Date("2026-03-15T12:00:00Z"); // Q1 2026
    const line = await prisma.assignmentCommission.create({
      data: {
        assignmentId: asg.id,
        teamId: teams.t1.id,
        assignmentTotalCents: 25_000,
        commissionType: "percentage",
        commissionValue: 1500,
        commissionAmountCents: 3_750,
        computedAt,
      },
    });
    await prisma.commissionPayout.create({
      data: {
        teamId: teams.t1.id,
        year: 2026,
        quarter: 1,
        amountCents: 3_750,
        paidAt: new Date(),
      },
    });
    const res = await changeAssignmentStatusInner(admin, asg.id, {
      to: "awaiting",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/Q1 2026/);
      expect(res.error).toMatch(/marked paid/);
    }
    // Commission line and assignment status untouched.
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true },
    });
    expect(after.status).toBe("completed");
    const lineAfter = await prisma.assignmentCommission.findUnique({
      where: { id: line.id },
    });
    expect(lineAfter).not.toBeNull();
  });
});

describe("changeAssignmentStatusInner — miscellaneous", () => {
  it("rejects with 'Assignment not found' when id doesn't exist", async () => {
    const { admin } = await seedBaseline();
    const res = await changeAssignmentStatusInner(admin, "a_missing", {
      to: "scheduled",
    });
    expect(res).toEqual({ ok: false, error: "Assignment not found." });
  });

  it("rejects invalid target status values", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_invalid_target",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await changeAssignmentStatusInner(admin, asg.id, {
      // Intentional: bypass TS union to feed bad data through the action.
      to: "enchanted" as unknown as "scheduled",
    });
    expect(res).toEqual({ ok: false, error: "Invalid status." });
  });

  it("emits an audit row tagged with the canonical verb for the target", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_audit_verb",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    await changeAssignmentStatusInner(admin, asg.id, { to: "in_progress" });
    const audits = await prisma.auditLog.findMany({
      where: { actorId: admin.user.id, objectId: asg.id },
      select: { verb: true },
    });
    expect(audits.map((a) => a.verb)).toContain("assignment.started");
  });
});
