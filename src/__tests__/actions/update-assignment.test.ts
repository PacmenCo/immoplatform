import { describe, expect, it } from "vitest";
import { updateAssignmentInner } from "@/app/actions/assignments";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";

// Optimistic-locking suite. Verifies that `updateAssignmentInner` rejects
// stale-snapshot saves (someone else edited the row first) with a distinct
// error from the existing terminal-state guard, while preserving the
// previous behavior for callers that don't yet pass `loaded-at`.

setupTestDb();

// Build a minimal-but-valid FormData matching `updateSchema`.
// `loadedAt` is appended only when set — tests pass a real ISO string for
// the locked path, omit it for the legacy fall-through, and pass an
// intentionally-stale string to exercise the collision branch.
function buildUpdateForm(
  overrides: Record<string, string> = {},
  loadedAt?: string,
): FormData {
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
  if (loadedAt !== undefined) fd.set("loaded-at", loadedAt);
  return fd;
}

describe("updateAssignmentInner — optimistic locking", () => {
  it("rejects a stale `loaded-at` with the concurrent-edit error", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_optimistic_stale",
      status: "scheduled",
      teamId: teams.t1.id,
      preferredDate: new Date("2026-04-01T10:00:00Z"),
    });

    // Simulate another tab winning the race: bump `updatedAt` between the
    // user's page-load and submit. We capture the original snapshot first
    // so we can post it back as the (now stale) `loaded-at`.
    const originalUpdatedAt = asg.updatedAt;
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { address: "Other tab won", updatedAt: new Date() },
    });

    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm(
        { address: "My pending change" },
        originalUpdatedAt.toISOString(),
      ),
    );
    expect(res).toEqual({
      ok: false,
      error:
        "Someone else just edited this assignment. Reload to see their changes.",
    });

    // The "winning" tab's address should still be in the row — our stale
    // submit must NOT have clobbered it.
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { address: true },
    });
    expect(after.address).toBe("Other tab won");
  });

  it("accepts an up-to-date `loaded-at` and writes the changes", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_optimistic_fresh",
      status: "scheduled",
      teamId: teams.t1.id,
    });

    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm(
        { address: "Updated address 12" },
        asg.updatedAt.toISOString(),
      ),
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { address: true },
    });
    expect(after.address).toBe("Updated address 12");
  });

  it("falls through to last-write-wins when the form omits `loaded-at`", async () => {
    // Defensive default for callers that haven't been migrated yet — the
    // pre-locking behavior should still produce a successful save even if
    // someone else just edited. Verifies we didn't accidentally make the
    // lock mandatory for everyone.
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_optimistic_legacy",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    // Bump updatedAt so a strict lock would fail — a legacy form without
    // `loaded-at` should not care.
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { address: "Other tab", updatedAt: new Date() },
    });

    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm({ address: "Legacy client save" }),
      // No loaded-at passed — explicit undefined.
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { address: true },
    });
    expect(after.address).toBe("Legacy client save");
  });

  it("does not surface the stale-snapshot copy when the row is terminal", async () => {
    // Guards the discrimination: a cancelled row must hit the terminal
    // path, never the new "Someone else just edited" copy. The early-
    // return at the top of the action wins for an already-cancelled row,
    // which is the most common real-world race shape.
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_optimistic_terminal",
      status: "scheduled",
      teamId: teams.t1.id,
    });

    const originalUpdatedAt = asg.updatedAt;
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { status: "cancelled" },
    });
    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm(
        { address: "Trying after cancel" },
        originalUpdatedAt.toISOString(),
      ),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).not.toContain("Someone else just edited");
      expect(res.error).toMatch(/cancelled/i);
    }
  });

  it("rejects a malformed `loaded-at` by treating it as missing (legacy fall-through)", async () => {
    // A garbage value in the hidden field shouldn't poison every save with
    // a permanent stale-snapshot error. parseLoadedAt returns null for
    // unparseable dates, so the action falls through to the pre-lock path.
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_optimistic_garbage",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm({ address: "Garbage loaded-at" }, "not-a-date"),
    );
    expect(res).toEqual({ ok: true });
  });
});

// Gap-filling tests for the wide-edit path manually verified via Playwright
// in the realtor-wide-edit flow-parity scenario. The optimistic-locking
// suite above covers the predicate; these cover the actual write semantics
// (services snapshot replace, basic field writes, scope gating).

describe("updateAssignmentInner — wide-edit write semantics", () => {
  it("adding a service to an existing assignment replaces the service list and snapshots prices", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_wide_services_add",
      status: "scheduled",
      teamId: teams.t1.id,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm(
        { service_asbestos: "on", service_epc: "on" },
        asg.updatedAt.toISOString(),
      ),
    );
    expect(res).toEqual({ ok: true });

    const lines = await prisma.assignmentService.findMany({
      where: { assignmentId: asg.id },
      orderBy: { serviceKey: "asc" },
      select: { serviceKey: true, unitPriceCents: true },
    });
    // EPC catalog price = 15_000 cents (seedServices fixture).
    expect(lines).toEqual([
      { serviceKey: "asbestos", unitPriceCents: 25_000 },
      { serviceKey: "epc", unitPriceCents: 15_000 },
    ]);
  });

  it("removing a service drops the line; snapshot replace is total, not additive", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_wide_services_drop",
      status: "scheduled",
      teamId: teams.t1.id,
      services: [
        { serviceKey: "asbestos", unitPriceCents: 25_000 },
        { serviceKey: "epc", unitPriceCents: 15_000 },
      ],
    });

    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm(
        // Only asbestos in the new payload — EPC line should be gone.
        { service_asbestos: "on" },
        asg.updatedAt.toISOString(),
      ),
    );
    expect(res).toEqual({ ok: true });
    const lines = await prisma.assignmentService.findMany({
      where: { assignmentId: asg.id },
      select: { serviceKey: true },
    });
    expect(lines).toEqual([{ serviceKey: "asbestos" }]);
  });

  it("ownerEmail change persists through the wide-edit path", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_wide_owner_email",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm(
        { "owner-email": "new-owner@example.test" },
        asg.updatedAt.toISOString(),
      ),
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { ownerEmail: true },
    });
    expect(after.ownerEmail).toBe("new-owner@example.test");
  });

  it("combined edit (date + service add + ownerEmail) lands in one save and emits a single assignment.updated audit", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_wide_combined",
      status: "scheduled",
      teamId: teams.t1.id,
      preferredDate: new Date("2026-04-01T10:00:00Z"),
    });

    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm(
        {
          "preferred-date": "2026-06-15",
          service_asbestos: "on",
          service_epc: "on",
          "owner-email": "combined@example.test",
        },
        asg.updatedAt.toISOString(),
      ),
    );
    expect(res).toEqual({ ok: true });

    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { ownerEmail: true, preferredDate: true },
    });
    expect(after.ownerEmail).toBe("combined@example.test");
    expect(after.preferredDate?.toISOString().slice(0, 10)).toBe("2026-06-15");

    const audits = await prisma.auditLog.findMany({
      where: { verb: "assignment.updated", objectId: asg.id },
    });
    expect(audits).toHaveLength(1);
  });

  it("realtor can edit her own team's assignment (positive scope)", async () => {
    const { realtor, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_wide_realtor_own",
      status: "scheduled",
      teamId: teams.t1.id,
      createdById: realtor.user.id,
    });
    const res = await updateAssignmentInner(
      realtor,
      asg.id,
      undefined,
      buildUpdateForm(
        { address: "Realtor edited her own row" },
        asg.updatedAt.toISOString(),
      ),
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { address: true },
    });
    expect(after.address).toBe("Realtor edited her own row");
  });

  it("realtor cannot edit another team's assignment (negative scope)", async () => {
    const { realtor, teams } = await seedBaseline();
    // Seed an assignment on the OTHER team (t2) that the baseline realtor
    // doesn't own. canEditAssignment must refuse.
    const asg = await seedAssignment({
      id: "a_wide_realtor_other_team",
      status: "scheduled",
      teamId: teams.t2.id,
    });
    const res = await updateAssignmentInner(
      realtor,
      asg.id,
      undefined,
      buildUpdateForm(
        { address: "Trying cross-team write" },
        asg.updatedAt.toISOString(),
      ),
    );
    expect(res.ok).toBe(false);
    // Row is unchanged regardless of error copy.
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { address: true },
    });
    expect(after.address).toBe("1 Teststraat");
  });

  it("freelancer-routed update writes only the allowlisted fields (date), drops everything else", async () => {
    // v1 parity (Platform/AssignmentController.php:406-439): a freelancer's
    // edit submission only carries preferred-date / status / new-comment.
    // v2's `filterUpdateForFreelancer` (permissions.ts:209-216) strips
    // everything else BEFORE it reaches `applyFreelancerUpdate`. This test
    // verifies the route — submit a fully-populated wide form as a
    // freelancer and confirm the row's address/services/owner stay put.
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_wide_freelancer_filter",
      status: "awaiting",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
    });

    const res = await updateAssignmentInner(
      freelancer,
      asg.id,
      undefined,
      buildUpdateForm(
        {
          // Junk that should NOT survive the freelancer-filter:
          address: "Freelancer trying to rewrite address",
          city: "Freelancer trying to rewrite city",
          "owner-name": "Freelancer trying to rewrite owner",
          // Allowlisted: preferred-date — this should land + auto-promote
          "preferred-date": "2026-08-15",
        },
        asg.updatedAt.toISOString(),
      ),
    );
    expect(res).toEqual({ ok: true });

    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: {
        address: true,
        city: true,
        ownerName: true,
        preferredDate: true,
        status: true,
      },
    });
    // Address/city/ownerName must be untouched (filtered out).
    expect(after.address).toBe("1 Teststraat");
    expect(after.city).toBe("Antwerpen");
    expect(after.ownerName).toBe("Test Owner");
    // Preferred date landed + auto-status flipped awaiting → scheduled.
    expect(after.preferredDate?.toISOString().slice(0, 10)).toBe("2026-08-15");
    expect(after.status).toBe("scheduled");
  });
});

// ─── Inline pricelist-item picker (`service_<key>_product`) ────────
//
// Mirror of the create-assignment tests, on the update path. The picker
// is rendered inline under each service checkbox; its hidden field carries
// the chosen Odoo product template id forward across edits. When the
// picker isn't rendered for a service (no team binding), the prior id
// must be preserved — the action only overwrites when the field appears
// in the submitted FormData.
describe("updateAssignmentInner — pricelist item picker", () => {
  it("submitting service_<key>_product updates odooProductTemplateId", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_picker_set",
      status: "scheduled",
      teamId: teams.t1.id,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    const fd = buildUpdateForm();
    fd.set("service_asbestos_product", "105");

    const res = await updateAssignmentInner(admin, asg.id, undefined, fd);
    expect(res).toEqual({ ok: true });

    const line = await prisma.assignmentService.findUniqueOrThrow({
      where: { assignmentId_serviceKey: { assignmentId: asg.id, serviceKey: "asbestos" } },
    });
    expect(line.odooProductTemplateId).toBe(105);
  });

  it("submitting empty service_<key>_product clears a previously-set id", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_picker_clear",
      status: "scheduled",
      teamId: teams.t1.id,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    // Seed a non-null pre-pick directly (mirrors what the create path would do).
    await prisma.assignmentService.update({
      where: { assignmentId_serviceKey: { assignmentId: asg.id, serviceKey: "asbestos" } },
      data: { odooProductTemplateId: 42 },
    });

    const fd = buildUpdateForm();
    fd.set("service_asbestos_product", "");

    const res = await updateAssignmentInner(admin, asg.id, undefined, fd);
    expect(res).toEqual({ ok: true });

    const line = await prisma.assignmentService.findUniqueOrThrow({
      where: { assignmentId_serviceKey: { assignmentId: asg.id, serviceKey: "asbestos" } },
    });
    expect(line.odooProductTemplateId).toBeNull();
  });

  it("MISSING service_<key>_product field preserves the prior value (no picker rendered)", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_picker_missing",
      status: "scheduled",
      teamId: teams.t1.id,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    await prisma.assignmentService.update({
      where: { assignmentId_serviceKey: { assignmentId: asg.id, serviceKey: "asbestos" } },
      data: { odooProductTemplateId: 42 },
    });

    // No `service_asbestos_product` key in form data — simulates a save
    // from a form variant where the picker wasn't rendered (no binding).
    const fd = buildUpdateForm();

    const res = await updateAssignmentInner(admin, asg.id, undefined, fd);
    expect(res).toEqual({ ok: true });

    const line = await prisma.assignmentService.findUniqueOrThrow({
      where: { assignmentId_serviceKey: { assignmentId: asg.id, serviceKey: "asbestos" } },
    });
    expect(line.odooProductTemplateId).toBe(42);
  });

  it("non-numeric / negative picker value → coerced to null", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_picker_garbage",
      status: "scheduled",
      teamId: teams.t1.id,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    const fd = buildUpdateForm();
    fd.set("service_asbestos_product", "not-a-number");
    const res = await updateAssignmentInner(admin, asg.id, undefined, fd);
    expect(res).toEqual({ ok: true });

    const line = await prisma.assignmentService.findUniqueOrThrow({
      where: { assignmentId_serviceKey: { assignmentId: asg.id, serviceKey: "asbestos" } },
    });
    expect(line.odooProductTemplateId).toBeNull();
  });

  // Filter-regression guard: same as the create-side test. If the service
  // extraction filter ever regresses to `k.startsWith("service_")` again,
  // the picker's hidden field would inflate the parsed services list and
  // fail Zod's enum check.
  it("picker hidden field does not leak into the parsed services list", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_picker_filter",
      status: "scheduled",
      teamId: teams.t1.id,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    const fd = buildUpdateForm();
    fd.set("service_asbestos_product", "105");

    const res = await updateAssignmentInner(admin, asg.id, undefined, fd);
    expect(res).toEqual({ ok: true });

    const lines = await prisma.assignmentService.findMany({
      where: { assignmentId: asg.id },
      select: { serviceKey: true },
    });
    expect(lines.map((l) => l.serviceKey).sort()).toEqual(["asbestos"]);
  });
});
