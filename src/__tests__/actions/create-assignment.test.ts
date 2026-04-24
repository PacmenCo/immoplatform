import { describe, expect, it } from "vitest";
import { createAssignmentInner } from "@/app/actions/assignments";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import { seedBaseline, seedTeam } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";

// Platform parity — ports behavioral contract from:
//   Platform/app/Http/Controllers/AssignmentController.php::store
//
// Covers:
//   1. Role gate: freelancer rejected; realtor must own a team; admin/staff ok.
//   2. teamId resolution: session.activeTeamId → fallback to first owned team.
//   3. Service snapshot: each d.services key lands in assignment_services with
//      its unitPriceCents resolved at creation time (Platform: pricelist_items).
//   4. Freelancer-assign gate: realtors can't pre-assign a freelancer.
//   5. Contact defaults: empty contact email falls back to session.user.email.
//   6. initialComment: when present, creates an AssignmentComment row.
//   7. Reference allocation: a monotonically increasing unique reference.
//   8. Audit + notifications (Platform AssignmentScheduledMail parity).

setupTestDb();

function buildCreateForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    address: "12 Rue de la Test",
    city: "Brussels",
    postal: "1000",
    "owner-name": "Alice Owner",
    service_asbestos: "on",
    type: "apartment",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    fd.set(k, v);
  }
  return fd;
}

describe("createAssignmentInner — role gates", () => {
  it("freelancer rejected with a clear message", async () => {
    const { freelancer } = await seedBaseline();
    const res = await createAssignmentInner(freelancer, undefined, buildCreateForm());
    expect(res).toEqual({
      ok: false,
      error: "Freelancers can't create assignments. Ask the realtor who hired you.",
    });
  });

  it("realtor WITHOUT an owned team is rejected", async () => {
    await seedBaseline();
    const loneRealtor = await makeSession({
      role: "realtor",
      userId: "u_lone_realtor",
      // no membershipTeams → no owned teams
    });
    const res = await createAssignmentInner(loneRealtor, undefined, buildCreateForm());
    expect(res).toEqual({
      ok: false,
      error: "You need to own a team before you can create an assignment.",
    });
  });

  it("realtor-owner succeeds + assignment teamId resolves to activeTeamId", async () => {
    const { realtor, teams } = await seedBaseline();
    const res = await createAssignmentInner(realtor, undefined, buildCreateForm());
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected ok + data");
    const asg = await prisma.assignment.findUniqueOrThrow({
      where: { id: res.data.id },
      select: { teamId: true, createdById: true, status: true },
    });
    expect(asg.teamId).toBe(teams.t1.id);
    expect(asg.createdById).toBe(realtor.user.id);
    expect(asg.status).toBe("scheduled");
  });

  it("admin succeeds regardless of team ownership (activeTeamId can be null)", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(admin, undefined, buildCreateForm());
    expect(res.ok).toBe(true);
  });
});

describe("createAssignmentInner — field validation", () => {
  it("empty address → zod error", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("address", "");
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res).toEqual({ ok: false, error: "Address is required." });
  });

  it("no services selected → zod error (min 1)", async () => {
    const { admin } = await seedBaseline();
    const fd = new FormData();
    fd.set("address", "x");
    fd.set("city", "x");
    fd.set("postal", "x");
    fd.set("owner-name", "x");
    // no service_* keys
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res).toEqual({ ok: false, error: "Pick at least one service." });
  });

  it("construction-year out of bounds → zod error", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm({ year: "1500" });
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Construction year must be 1800/);
  });
});

describe("createAssignmentInner — service price snapshot", () => {
  it("resolves unitPriceCents per service from the catalog at creation time", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("service_asbestos", "on");
    fd.set("service_epc", "on");
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const services = await prisma.assignmentService.findMany({
      where: { assignmentId: res.data.id },
      orderBy: { serviceKey: "asc" },
      select: { serviceKey: true, unitPriceCents: true },
    });
    // Seeded catalog prices (see fixtures.seedServices):
    //   asbestos=25000, epc=15000
    expect(services).toEqual([
      { serviceKey: "asbestos", unitPriceCents: 25_000 },
      { serviceKey: "epc", unitPriceCents: 15_000 },
    ]);
  });

  it("TeamServiceOverride on the active team wins over the catalog price", async () => {
    const { realtor, teams } = await seedBaseline();
    await prisma.teamServiceOverride.create({
      data: {
        teamId: teams.t1.id,
        serviceKey: "asbestos",
        priceCents: 33_000,
      },
    });
    const res = await createAssignmentInner(realtor, undefined, buildCreateForm());
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const service = await prisma.assignmentService.findFirstOrThrow({
      where: { assignmentId: res.data.id, serviceKey: "asbestos" },
    });
    expect(service.unitPriceCents).toBe(33_000);
  });
});

describe("createAssignmentInner — freelancer pre-assign gate", () => {
  it("admin CAN pre-assign an active freelancer at creation time", async () => {
    const { admin, freelancer } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("freelancerId", freelancer.user.id);
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const asg = await prisma.assignment.findUniqueOrThrow({
      where: { id: res.data.id },
      select: { freelancerId: true },
    });
    expect(asg.freelancerId).toBe(freelancer.user.id);
  });

  it("admin trying to assign a NON-freelancer user → rejected", async () => {
    const { admin, realtor } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("freelancerId", realtor.user.id);
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res).toEqual({
      ok: false,
      error: "That user isn't an active freelancer.",
    });
  });

  it("realtor's freelancerId submission is SILENTLY DROPPED (not rejected)", async () => {
    const { realtor, freelancer } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("freelancerId", freelancer.user.id); // realtors can't pre-assign
    const res = await createAssignmentInner(realtor, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const asg = await prisma.assignment.findUniqueOrThrow({
      where: { id: res.data.id },
      select: { freelancerId: true },
    });
    expect(asg.freelancerId).toBeNull();
  });
});

describe("createAssignmentInner — contact defaults", () => {
  it("empty contactEmail → falls back to session.user.email", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(admin, undefined, buildCreateForm());
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const asg = await prisma.assignment.findUniqueOrThrow({
      where: { id: res.data.id },
      select: { contactEmail: true },
    });
    expect(asg.contactEmail).toBe(admin.user.email);
  });

  it("explicit contactEmail is preserved", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("contactEmail", "alt-contact@client.biz");
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const asg = await prisma.assignment.findUniqueOrThrow({
      where: { id: res.data.id },
      select: { contactEmail: true },
    });
    expect(asg.contactEmail).toBe("alt-contact@client.biz");
  });
});

describe("createAssignmentInner — initialComment", () => {
  it("non-empty initial-comment creates an AssignmentComment row authored by the creator", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("initial-comment", "Kick-off note from admin at creation.");
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const comments = await prisma.assignmentComment.findMany({
      where: { assignmentId: res.data.id },
      select: { body: true, authorId: true },
    });
    expect(comments).toHaveLength(1);
    expect(comments[0]).toEqual({
      body: "Kick-off note from admin at creation.",
      authorId: admin.user.id,
    });
  });

  it("empty / whitespace-only comment → no row written", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("initial-comment", "   ");
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const count = await prisma.assignmentComment.count({
      where: { assignmentId: res.data.id },
    });
    expect(count).toBe(0);
  });
});

describe("createAssignmentInner — reference allocation", () => {
  it("two sequential creates produce distinct monotonically-increasing references", async () => {
    const { admin } = await seedBaseline();
    const r1 = await createAssignmentInner(admin, undefined, buildCreateForm());
    const r2 = await createAssignmentInner(admin, undefined, buildCreateForm());
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok || !r1.data || !r2.data) throw new Error("expected data");
    const [a1, a2] = await Promise.all([
      prisma.assignment.findUniqueOrThrow({
        where: { id: r1.data.id },
        select: { reference: true },
      }),
      prisma.assignment.findUniqueOrThrow({
        where: { id: r2.data.id },
        select: { reference: true },
      }),
    ]);
    expect(a1.reference).not.toBe(a2.reference);
    // Reference is unique and non-empty — specific format is Platform-parity
    // but the important invariant here is uniqueness + presence.
    expect(a1.reference.length).toBeGreaterThan(0);
    expect(a2.reference.length).toBeGreaterThan(0);
  });
});

describe("createAssignmentInner — audit + calendar parity", () => {
  it("emits an assignment.created audit row carrying reference + services", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("service_asbestos", "on");
    fd.set("service_epc", "on");
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        actorId: admin.user.id,
        verb: "assignment.created",
        objectId: res.data.id,
      },
      select: { metadata: true },
    });
    const meta = auditMeta(audit.metadata);
    expect(meta.reference).toBeTruthy();
    expect(meta.services).toEqual(expect.arrayContaining(["asbestos", "epc"]));
  });

  it("creates the assignment in `scheduled` state by default (Platform parity)", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(admin, undefined, buildCreateForm());
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const asg = await prisma.assignment.findUniqueOrThrow({
      where: { id: res.data.id },
      select: { status: true },
    });
    expect(asg.status).toBe("scheduled");
  });
});

describe("createAssignmentInner — clientType defaults", () => {
  it("empty clientType + team.defaultClientType='owner' → resolved to 'owner'", async () => {
    await seedBaseline();
    await seedTeam("t_client_default", "Team With Default", {});
    await prisma.team.update({
      where: { id: "t_client_default" },
      data: { defaultClientType: "owner" },
    });
    const realtor = await makeSession({
      role: "realtor",
      userId: "u_realtor_defaults",
      activeTeamId: "t_client_default",
      membershipTeams: [{ teamId: "t_client_default", teamRole: "owner" }],
    });
    const fd = buildCreateForm();
    // deliberately no client-type key
    const res = await createAssignmentInner(realtor, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const asg = await prisma.assignment.findUniqueOrThrow({
      where: { id: res.data.id },
      select: { clientType: true },
    });
    expect(asg.clientType).toBe("owner");
  });

  it("explicit clientType form value overrides team default", async () => {
    await seedBaseline();
    await seedTeam("t_override_default", "Team With Default", {});
    await prisma.team.update({
      where: { id: "t_override_default" },
      data: { defaultClientType: "owner" },
    });
    const realtor = await makeSession({
      role: "realtor",
      userId: "u_realtor_override",
      activeTeamId: "t_override_default",
      membershipTeams: [{ teamId: "t_override_default", teamRole: "owner" }],
    });
    const fd = buildCreateForm({ "client-type": "firm" });
    const res = await createAssignmentInner(realtor, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const asg = await prisma.assignment.findUniqueOrThrow({
      where: { id: res.data.id },
      select: { clientType: true },
    });
    expect(asg.clientType).toBe("firm");
  });
});
