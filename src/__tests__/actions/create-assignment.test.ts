import { describe, expect, it } from "vitest";
import { createAssignmentInner } from "@/app/actions/assignments";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import { seedBaseline, seedTeam } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";
import { makeUploadFile } from "../_helpers/upload";

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

  it("preferred-date in the past → rejected (Platform parity: before:today rule)", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm({ "preferred-date": "1990-01-01" });
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Planned date can't be in the past/);
  });

  it("preferred-date today is allowed (boundary)", async () => {
    const { admin } = await seedBaseline();
    const today = new Date().toISOString().slice(0, 10);
    const fd = buildCreateForm({ "preferred-date": today });
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(true);
  });

  it("owner-phone over 20 chars → rejected (Platform parity max:20)", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm({ "owner-phone": "+32 470 12 34 56 ext 12345" });
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Phone number is too long/);
  });

  it("owner-phone within 20 chars accepted (Belgian formats)", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm({ "owner-phone": "+32 470 12 34 56" });
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(true);
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

// ─── Realtor-lane file attach at create time ────────────────────────
//
// Platform parity (AssignmentController::store @ 256-258 +
// processMakelaarFiles @ 852-907): the create form's `makelaar_files[]`
// input is processed AFTER `Assignment::create` returns. We mirror that
// two-step contract via `uploadAssignmentFilesInner` keyed by the new id;
// failures here must NOT roll back the assignment, since the user has no
// way to recover the typed form data.
describe("createAssignmentInner — realtor-lane file attach", () => {
  it("realtor creates assignment WITH 2 PDF files → both attached, lane=realtor", async () => {
    const { realtor, teams } = await seedBaseline();
    const fd = buildCreateForm();
    fd.append("makelaar-file", makeUploadFile("plan.pdf"));
    fd.append("makelaar-file", makeUploadFile("notes.pdf"));

    const res = await createAssignmentInner(realtor, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    expect(res.warning).toBeUndefined();

    const asg = await prisma.assignment.findUniqueOrThrow({
      where: { id: res.data.id },
      select: { teamId: true, createdById: true },
    });
    expect(asg.teamId).toBe(teams.t1.id);
    expect(asg.createdById).toBe(realtor.user.id);

    const files = await prisma.assignmentFile.findMany({
      where: { assignmentId: res.data.id },
      orderBy: { originalName: "asc" },
      select: {
        lane: true,
        originalName: true,
        mimeType: true,
        uploaderId: true,
      },
    });
    expect(files).toEqual([
      {
        lane: "realtor",
        originalName: "notes.pdf",
        mimeType: "application/pdf",
        uploaderId: realtor.user.id,
      },
      {
        lane: "realtor",
        originalName: "plan.pdf",
        mimeType: "application/pdf",
        uploaderId: realtor.user.id,
      },
    ]);
  });

  it("11 attached files → rejected before create, no row written", async () => {
    const { realtor } = await seedBaseline();
    const fd = buildCreateForm();
    for (let i = 0; i < 11; i++) {
      fd.append("makelaar-file", makeUploadFile(`f${i}.pdf`));
    }

    const before = await prisma.assignment.count();
    const res = await createAssignmentInner(realtor, undefined, fd);
    expect(res).toEqual({
      ok: false,
      error: "Up to 10 files at a time.",
    });
    // No row created — pre-create gate stopped us before prisma.create.
    const after = await prisma.assignment.count();
    expect(after).toBe(before);
  });

  it("no files → behaves exactly as before (no warning, no file rows)", async () => {
    const { realtor } = await seedBaseline();
    const res = await createAssignmentInner(realtor, undefined, buildCreateForm());
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    expect(res.warning).toBeUndefined();

    const fileCount = await prisma.assignmentFile.count({
      where: { assignmentId: res.data.id },
    });
    expect(fileCount).toBe(0);
  });

  it("file upload step fails (bad MIME) → assignment still created, ok with warning", async () => {
    const { realtor } = await seedBaseline();
    const fd = buildCreateForm();
    // Forge a TXT file. Upload action's MIME allowlist rejects it inside
    // uploadAssignmentFilesInner, but only AFTER the assignment row is
    // committed — so the row should still exist with a warning surfaced.
    fd.append(
      "makelaar-file",
      new File(["plain text content"], "readme.txt", { type: "text/plain" }),
    );

    const res = await createAssignmentInner(realtor, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    expect(res.warning).toMatch(/Some files failed to upload/);

    // Row exists — best-effort failure should not roll back the assignment.
    const asg = await prisma.assignment.findUnique({
      where: { id: res.data.id },
      select: { id: true, createdById: true },
    });
    expect(asg).toMatchObject({ id: res.data.id, createdById: realtor.user.id });
    // No file rows because the upload bailed before the createMany.
    const fileCount = await prisma.assignmentFile.count({
      where: { assignmentId: res.data.id },
    });
    expect(fileCount).toBe(0);
  });
});

// ─── Inline pricelist-item picker (`service_<key>_product`) ────────
//
// When a team is bound to an Odoo pricelist for a service, the create form
// renders a typeahead under the service checkbox that submits a hidden
// `service_<key>_product` field carrying the chosen Odoo product template
// id. The action snapshots that id onto the matching AssignmentService row
// so later invoicing knows which exact SKU was sold.
//
// Critical regression guard: the service-extraction filter must NOT include
// the picker's hidden field as a fake service key (would land as
// "asbestos_product" in the parsed list and fail Zod's enum check).
describe("createAssignmentInner — pricelist item picker", () => {
  it("service_<key>_product writes odooProductTemplateId on the matching line", async () => {
    const { admin, teams } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("service_asbestos_product", "105");

    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected ok + data");

    const lines = await prisma.assignmentService.findMany({
      where: { assignmentId: res.data.id },
      select: { serviceKey: true, odooProductTemplateId: true },
    });
    expect(lines).toEqual([
      { serviceKey: "asbestos", odooProductTemplateId: 105 },
    ]);

    // The team for an admin without an activeTeamId is null; teamId on the
    // assignment row reflects that — but the line still carries the snapshot.
    const asg = await prisma.assignment.findUniqueOrThrow({
      where: { id: res.data.id },
      select: { teamId: true },
    });
    void asg.teamId;
    void teams;
  });

  // The picker submits `service_<k>_price` alongside `_product`. The price
  // is the picked rule's `fixedPriceCents` and MUST become the assignment-
  // line snapshot — without this, the user picks "EPC-Certificaat €200" but
  // the line stores Service.unitPrice (e.g. €245). Silently wrong invoicing.
  it("service_<key>_price overrides Service.unitPrice on the line snapshot", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("service_asbestos_product", "105");
    fd.set("service_asbestos_price", "20000");

    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected ok + data");

    const line = await prisma.assignmentService.findFirstOrThrow({
      where: { assignmentId: res.data.id, serviceKey: "asbestos" },
    });
    expect(line.unitPriceCents).toBe(20000);
    expect(line.odooProductTemplateId).toBe(105);
  });

  it("missing _price (only _product set) falls back to resolved unit price", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("service_asbestos_product", "105");
    // No `_price` field — exercises the fallback path.

    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected ok + data");

    const line = await prisma.assignmentService.findFirstOrThrow({
      where: { assignmentId: res.data.id, serviceKey: "asbestos" },
    });
    // Falls through to Service.unitPrice (25000 per the seed) since no
    // team override exists.
    expect(line.unitPriceCents).toBe(25000);
  });

  it("missing picker field → odooProductTemplateId is null (back-compat)", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(admin, undefined, buildCreateForm());
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected ok + data");
    const line = await prisma.assignmentService.findFirstOrThrow({
      where: { assignmentId: res.data.id, serviceKey: "asbestos" },
    });
    expect(line.odooProductTemplateId).toBeNull();
  });

  it("non-numeric picker value → coerced to null (defensive parse)", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("service_asbestos_product", "not-a-number");
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected ok + data");
    const line = await prisma.assignmentService.findFirstOrThrow({
      where: { assignmentId: res.data.id, serviceKey: "asbestos" },
    });
    expect(line.odooProductTemplateId).toBeNull();
  });

  it("zero / negative picker value → coerced to null", async () => {
    const { admin } = await seedBaseline();
    const fd = buildCreateForm();
    fd.set("service_asbestos_product", "0");
    const r1 = await createAssignmentInner(admin, undefined, fd);
    expect(r1.ok).toBe(true);
    if (!r1.ok || !r1.data) throw new Error("expected ok + data");
    let line = await prisma.assignmentService.findFirstOrThrow({
      where: { assignmentId: r1.data.id, serviceKey: "asbestos" },
    });
    expect(line.odooProductTemplateId).toBeNull();

    const fd2 = buildCreateForm({ address: "13 Rue de la Test" });
    fd2.set("service_asbestos_product", "-5");
    const r2 = await createAssignmentInner(admin, undefined, fd2);
    expect(r2.ok).toBe(true);
    if (!r2.ok || !r2.data) throw new Error("expected ok + data");
    line = await prisma.assignmentService.findFirstOrThrow({
      where: { assignmentId: r2.data.id, serviceKey: "asbestos" },
    });
    expect(line.odooProductTemplateId).toBeNull();
  });

  // The original filter was `k.startsWith("service_")` — too greedy. It
  // pulled `service_asbestos_product=105` into the parsed services list as
  // `"asbestos_product"`, which Zod rejects (not in SERVICE_KEYS). This
  // test pins the tightened filter so the bug can't sneak back.
  it("picker hidden field does not leak into the parsed services list", async () => {
    const { admin } = await seedBaseline();
    // Submit the picker BUT leave the asbestos checkbox unchecked AND check
    // a different service. If the filter regresses, "asbestos_product"
    // will land in `services`, fail Zod, and the action will return ok:false.
    const fd = new FormData();
    fd.set("address", "1 Filterstraat");
    fd.set("city", "Brussels");
    fd.set("postal", "1000");
    fd.set("owner-name", "Bob Owner");
    fd.set("type", "apartment");
    fd.set("service_epc", "on");
    fd.set("service_asbestos_product", "105");
    const res = await createAssignmentInner(admin, undefined, fd);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected ok + data");
    const lines = await prisma.assignmentService.findMany({
      where: { assignmentId: res.data.id },
      select: { serviceKey: true },
    });
    expect(lines.map((l) => l.serviceKey).sort()).toEqual(["epc"]);
  });
});
