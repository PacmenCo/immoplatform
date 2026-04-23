import { describe, expect, it } from "vitest";
import { updateAssignmentInner } from "@/app/actions/assignments";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";

// Platform parity — ports:
//   Platform/app/Http/Controllers/AssignmentController.php::autoStatusForDateChange
//   (lines 1229-1262)
//
// Contract:
//   1) Setting preferredDate on an early-lifecycle assignment (draft / awaiting
//      / on_hold) auto-bumps status → "scheduled" so it lands on calendars
//      without a second save.
//   2) Clearing preferredDate on a "scheduled" assignment reverts to "awaiting"
//      so it doesn't sit on the schedule with no when.
//   3) Setting a date on non-early statuses (in_progress, delivered, …) leaves
//      status unchanged.

setupTestDb();

// Build a minimal-but-valid FormData matching `updateSchema`.
// Only the fields the zod parser requires are populated with sensible
// defaults — tests override `preferred-date` per case.
function buildUpdateForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    address: "1 Teststraat",
    city: "Antwerpen",
    postal: "2000",
    "owner-name": "Test Owner",
    // Zod requires ≥ 1 service; match the seeded assignment's existing one
    // so the delete-and-recreate path doesn't reprice it to 0.
    service_asbestos: "on",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    fd.set(k, v);
  }
  return fd;
}

describe("updateAssignmentInner — auto-scheduled on date set", () => {
  it("draft + date set → scheduled", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_draft_to_scheduled",
      status: "draft",
      teamId: teams.t1.id,
    });
    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm({ "preferred-date": "2026-05-10T10:00" }),
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true, preferredDate: true },
    });
    expect(after.status).toBe("scheduled");
    expect(after.preferredDate).toBeInstanceOf(Date);
  });

  it("awaiting + date set → scheduled", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_awaiting_to_scheduled",
      status: "awaiting",
      teamId: teams.t1.id,
    });
    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm({ "preferred-date": "2026-05-10T10:00" }),
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true },
    });
    expect(after.status).toBe("scheduled");
  });

  it("on_hold + date set → scheduled (on_hold is an EARLY_STATUS)", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_onhold_to_scheduled",
      status: "on_hold",
      teamId: teams.t1.id,
    });
    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm({ "preferred-date": "2026-05-10T10:00" }),
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true },
    });
    expect(after.status).toBe("scheduled");
  });

  it("in_progress + date set → status UNCHANGED (not an EARLY_STATUS)", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_inprogress_no_auto",
      status: "in_progress",
      teamId: teams.t1.id,
    });
    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm({ "preferred-date": "2026-05-10T10:00" }),
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true, preferredDate: true },
    });
    expect(after.status).toBe("in_progress");
    expect(after.preferredDate).toBeInstanceOf(Date);
  });

  it("scheduled + date REPLACED (not cleared) → status UNCHANGED", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_scheduled_redate",
      status: "scheduled",
      teamId: teams.t1.id,
      preferredDate: new Date("2026-04-01T10:00:00Z"),
    });
    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm({ "preferred-date": "2026-05-20T10:00" }),
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true, preferredDate: true },
    });
    expect(after.status).toBe("scheduled");
    // New date persisted.
    expect(after.preferredDate?.toISOString().startsWith("2026-05-20")).toBe(true);
  });
});

describe("updateAssignmentInner — auto-awaiting on date cleared", () => {
  it("scheduled + date cleared → awaiting", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_scheduled_to_awaiting",
      status: "scheduled",
      teamId: teams.t1.id,
      preferredDate: new Date("2026-04-01T10:00:00Z"),
    });
    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      // Omit preferred-date → zod parses as undefined → action treats as null
      buildUpdateForm({}),
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true, preferredDate: true },
    });
    expect(after.status).toBe("awaiting");
    expect(after.preferredDate).toBeNull();
  });

  it("in_progress + date cleared → status UNCHANGED (only `scheduled` reverts)", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_inprogress_date_cleared",
      status: "in_progress",
      teamId: teams.t1.id,
      preferredDate: new Date("2026-04-01T10:00:00Z"),
    });
    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm({}),
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true, preferredDate: true },
    });
    expect(after.status).toBe("in_progress");
    expect(after.preferredDate).toBeNull();
  });
});

describe("updateAssignmentInner — audit trail", () => {
  it("emits an audit row with autoStatusTransition metadata on auto-schedule", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_audit_autoschedule",
      status: "draft",
      teamId: teams.t1.id,
    });
    await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm({ "preferred-date": "2026-05-10T10:00" }),
    );
    const audits = await prisma.auditLog.findMany({
      where: { actorId: admin.user.id, objectId: asg.id },
      orderBy: { at: "asc" },
      select: { verb: true, metadata: true },
    });
    expect(audits.map((a) => a.verb)).toContain("assignment.updated");
    const updated = audits.find((a) => a.verb === "assignment.updated");
    const meta = JSON.parse(updated?.metadata ?? "{}");
    expect(meta.autoStatusTransition).toEqual({
      from: "draft",
      to: "scheduled",
      trigger: "date_set",
    });
  });

  it("emits autoStatusTransition trigger='date_cleared' on revert to awaiting", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_audit_autoawaiting",
      status: "scheduled",
      teamId: teams.t1.id,
      preferredDate: new Date("2026-04-01T10:00:00Z"),
    });
    await updateAssignmentInner(admin, asg.id, undefined, buildUpdateForm({}));
    const updated = await prisma.auditLog.findFirst({
      where: {
        actorId: admin.user.id,
        objectId: asg.id,
        verb: "assignment.updated",
      },
    });
    const meta = JSON.parse(updated?.metadata ?? "{}");
    expect(meta.autoStatusTransition).toEqual({
      from: "scheduled",
      to: "awaiting",
      trigger: "date_cleared",
    });
  });
});
