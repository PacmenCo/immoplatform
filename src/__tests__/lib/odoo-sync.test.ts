import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Odoo client at the module boundary. The orchestrator imports
// from "@/lib/odoo"; we control every Odoo round-trip via these spies.
// `vi.hoisted` keeps the spy refs in scope inside the hoisted `vi.mock`
// factory (vi.mock runs BEFORE module imports).
const mocks = vi.hoisted(() => ({
  isOdooConfigured: vi.fn<() => boolean>(),
  findPartnerByEmailOrVat: vi.fn<(email: string | null, vat: string | null) => Promise<number | null>>(),
  createPartner: vi.fn<(data: unknown) => Promise<number>>(),
  createSaleOrder: vi.fn<(data: unknown) => Promise<number>>(),
  addSaleOrderLine: vi.fn<(orderId: number, productId: number, priceUnit: number, qty?: number) => Promise<void>>(),
  findProductByName: vi.fn<(name: string) => Promise<{ id: number; lst_price: number } | null>>(),
  findProductByTemplateId: vi.fn<(tplId: number) => Promise<{ id: number; lst_price: number } | null>>(),
  getBelgiumCountryId: vi.fn<() => Promise<number | null>>(),
  getDefaultPricelistId: vi.fn<() => Promise<number | null>>(),
}));

vi.mock("@/lib/odoo", () => mocks);

// Email helper is mocked too — the orchestrator's failure path calls
// odooSyncFailedEmail(...). We just need a non-throwing stub so the
// failure test can assert "email was sent" without rendering React Email.
const emailMocks = vi.hoisted(() => ({
  odooSyncFailedEmail: vi.fn(async () => ({
    subject: "test-subject",
    html: "<p>test</p>",
    text: "test",
  })),
  sendEmail: vi.fn(async () => undefined),
}));
vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    ...actual,
    odooSyncFailedEmail: emailMocks.odooSyncFailedEmail,
    sendEmail: emailMocks.sendEmail,
  };
});

import { syncAssignmentToOdoo } from "@/lib/odoo-sync";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedBaseline, seedAssignment } from "../_helpers/fixtures";

setupTestDb();

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // The shared env helper sets SKIP_ODOO_SYNC=1 globally so other test
  // suites aren't affected. This file deliberately exercises the
  // orchestrator, so unblock it for every test in this file.
  process.env = { ...ORIGINAL_ENV };
  process.env.SKIP_ODOO_SYNC = "0";
  process.env.ODOO_SYNC_FAILURE_EMAIL = "ops@test.local";

  // mockReset clears both call history AND any per-test overrides, so
  // each test starts from a clean slate before we set the defaults.
  for (const m of Object.values(mocks)) m.mockReset();
  emailMocks.odooSyncFailedEmail.mockReset();
  emailMocks.sendEmail.mockReset();

  // Default mock responses match the asbestos+apartment happy path.
  mocks.isOdooConfigured.mockReturnValue(true);
  mocks.findPartnerByEmailOrVat.mockResolvedValue(null);
  mocks.createPartner.mockResolvedValue(11_001);
  mocks.createSaleOrder.mockResolvedValue(22_001);
  mocks.addSaleOrderLine.mockResolvedValue(undefined);
  mocks.findProductByName.mockResolvedValue({ id: 33_001, lst_price: 245 });
  mocks.findProductByTemplateId.mockResolvedValue({ id: 33_500, lst_price: 199 });
  mocks.getBelgiumCountryId.mockResolvedValue(21);
  mocks.getDefaultPricelistId.mockResolvedValue(7);
  emailMocks.odooSyncFailedEmail.mockResolvedValue({
    subject: "test-subject",
    html: "<p>test</p>",
    text: "test",
  });
  emailMocks.sendEmail.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function seedAsbestosDefaultMapping(): Promise<void> {
  // The default-team (teamId=null) row that the orchestrator's tier-2
  // resolver looks up. seedBaseline() doesn't seed mappings.
  await prisma.odooProductMapping.create({
    data: {
      teamId: null,
      serviceKey: "asbestos",
      propertyType: "apartment",
      odooProductName: "Niet-destructieve Asbestinventaris Appartement",
    },
  });
}

describe("syncAssignmentToOdoo — gates", () => {
  it("SKIP_ODOO_SYNC=1 → no-op (no DB writes, no Odoo calls)", async () => {
    process.env.SKIP_ODOO_SYNC = "1";
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({ teamId: teams.t1.id });

    await syncAssignmentToOdoo(asg.id, { trigger: "create" });

    expect(mocks.createPartner).not.toHaveBeenCalled();
    const after = await prisma.assignment.findUnique({ where: { id: asg.id } });
    expect(after?.odooSyncedAt).toBeNull();
    expect(after?.odooSyncError).toBeNull();
  });

  it("isOdooConfigured=false → silent skip (no email, no error column)", async () => {
    mocks.isOdooConfigured.mockReturnValue(false);
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({ teamId: teams.t1.id });

    await syncAssignmentToOdoo(asg.id);

    expect(mocks.createPartner).not.toHaveBeenCalled();
    expect(emailMocks.sendEmail).not.toHaveBeenCalled();
    const after = await prisma.assignment.findUnique({ where: { id: asg.id } });
    expect(after?.odooSyncError).toBeNull();
    expect(after?.odooSyncedAt).toBeNull();
  });

  it("assignment deleted before sync runs → no-op + warn", async () => {
    await seedBaseline();
    await syncAssignmentToOdoo("does-not-exist");
    expect(mocks.createPartner).not.toHaveBeenCalled();
    expect(emailMocks.sendEmail).not.toHaveBeenCalled();
  });

  it("already synced + no force → skip", async () => {
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({ teamId: teams.t1.id });
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { odooSyncedAt: new Date(), odooContactId: 9999, odooOrderId: 8888 },
    });

    await syncAssignmentToOdoo(asg.id);

    expect(mocks.createPartner).not.toHaveBeenCalled();
  });

  it("already synced + force=true → re-runs", async () => {
    const { teams } = await seedBaseline();
    await seedAsbestosDefaultMapping();
    const asg = await seedAssignment({ teamId: teams.t1.id });
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { odooSyncedAt: new Date() }, // simulate prior sync
    });

    await syncAssignmentToOdoo(asg.id, { force: true });

    // It re-enters the flow — partner is created since odooContactId is null.
    expect(mocks.createPartner).toHaveBeenCalledTimes(1);
  });
});

describe("syncAssignmentToOdoo — happy path", () => {
  it("asbestos + apartment → creates partner + order + line via tier-2 default mapping", async () => {
    const { teams } = await seedBaseline();
    await seedAsbestosDefaultMapping();
    const asg = await seedAssignment({
      teamId: teams.t1.id,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25000 }],
    });

    await syncAssignmentToOdoo(asg.id, { trigger: "create" });

    expect(mocks.createPartner).toHaveBeenCalledTimes(1);
    expect(mocks.createSaleOrder).toHaveBeenCalledTimes(1);
    expect(mocks.findProductByName).toHaveBeenCalledWith(
      "Niet-destructieve Asbestinventaris Appartement",
    );
    expect(mocks.addSaleOrderLine).toHaveBeenCalledTimes(1);

    const after = await prisma.assignment.findUnique({ where: { id: asg.id } });
    expect(after?.odooContactId).toBe(11_001);
    expect(after?.odooOrderId).toBe(22_001);
    expect(after?.odooSyncedAt).not.toBeNull();
    expect(after?.odooSyncError).toBeNull();
    expect(after?.odooSyncAttempts).toBe(0);
  });

  it("tier-1 per-team override beats tier-2 default", async () => {
    const { teams } = await seedBaseline();
    await seedAsbestosDefaultMapping();
    await prisma.odooProductMapping.create({
      data: {
        teamId: teams.t1.id,
        serviceKey: "asbestos",
        propertyType: "apartment",
        odooProductName: "Custom Team Product",
      },
    });
    const asg = await seedAssignment({ teamId: teams.t1.id });

    await syncAssignmentToOdoo(asg.id);

    expect(mocks.findProductByName).toHaveBeenCalledWith("Custom Team Product");
  });

  it("partner dedup: existing partner found → reuse, no createPartner", async () => {
    const { teams } = await seedBaseline();
    await seedAsbestosDefaultMapping();
    const asg = await seedAssignment({ teamId: teams.t1.id });
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { ownerEmail: "duplicate-owner@test.local" },
    });
    mocks.findPartnerByEmailOrVat.mockResolvedValue(99_999);

    await syncAssignmentToOdoo(asg.id);

    expect(mocks.createPartner).not.toHaveBeenCalled();
    const after = await prisma.assignment.findUnique({ where: { id: asg.id } });
    expect(after?.odooContactId).toBe(99_999);
  });

  it("tier-0: AssignmentService.odooProductTemplateId pre-pick wins", async () => {
    const { teams } = await seedBaseline();
    await seedAsbestosDefaultMapping();
    const asg = await seedAssignment({
      teamId: teams.t1.id,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25000 }],
    });
    // Set the pre-pick template id on the AssignmentService row.
    await prisma.assignmentService.update({
      where: { assignmentId_serviceKey: { assignmentId: asg.id, serviceKey: "asbestos" } },
      data: { odooProductTemplateId: 4242 },
    });

    await syncAssignmentToOdoo(asg.id);

    // tier-0 lookup wins — name-based resolver is bypassed
    expect(mocks.findProductByTemplateId).toHaveBeenCalledWith(4242);
    expect(mocks.findProductByName).not.toHaveBeenCalled();
    expect(mocks.addSaleOrderLine).toHaveBeenCalledTimes(1);
  });

  it("quantity > 1 → product_uom_qty matches", async () => {
    const { teams } = await seedBaseline();
    await seedAsbestosDefaultMapping();
    const asg = await seedAssignment({ teamId: teams.t1.id, quantity: 3 });

    await syncAssignmentToOdoo(asg.id);

    expect(mocks.addSaleOrderLine).toHaveBeenCalledWith(
      22_001,
      33_001,
      245,
      3,
    );
  });
});

describe("syncAssignmentToOdoo — warning path", () => {
  it("commercial property + asbestos → warning, sync marked done, no email", async () => {
    const { teams } = await seedBaseline();
    // No mapping exists for commercial — even default tier seeds skip it.
    await seedAsbestosDefaultMapping();
    const asg = await seedAssignment({
      teamId: teams.t1.id,
      propertyType: "commercial",
    });

    await syncAssignmentToOdoo(asg.id);

    // Partner + order created (resolver runs after partner+order persist)
    expect(mocks.createPartner).toHaveBeenCalled();
    expect(mocks.createSaleOrder).toHaveBeenCalled();
    // No line written when product name is unmapped
    expect(mocks.addSaleOrderLine).not.toHaveBeenCalled();
    // No email — warning is not a failure
    expect(emailMocks.sendEmail).not.toHaveBeenCalled();

    const after = await prisma.assignment.findUnique({ where: { id: asg.id } });
    expect(after?.odooSyncedAt).not.toBeNull();
    expect(after?.odooSyncError).toMatch(/Handmatige offerte vereist/);
  });
});

describe("syncAssignmentToOdoo — failure path", () => {
  it("createPartner throws → odooSyncError set, attempt++, email sent", async () => {
    const { teams } = await seedBaseline();
    await seedAsbestosDefaultMapping();
    const asg = await seedAssignment({ teamId: teams.t1.id });

    mocks.createPartner.mockRejectedValueOnce(
      new Error("Odoo res.partner.create: AccessDenied"),
    );

    await syncAssignmentToOdoo(asg.id);

    const after = await prisma.assignment.findUnique({ where: { id: asg.id } });
    expect(after?.odooSyncedAt).toBeNull();
    expect(after?.odooSyncError).toContain("AccessDenied");
    expect(after?.odooSyncAttempts).toBe(1);
    expect(emailMocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("findProductByName returns null → throws → failure path", async () => {
    const { teams } = await seedBaseline();
    await seedAsbestosDefaultMapping();
    const asg = await seedAssignment({ teamId: teams.t1.id });

    mocks.findProductByName.mockResolvedValueOnce(null);

    await syncAssignmentToOdoo(asg.id);

    const after = await prisma.assignment.findUnique({ where: { id: asg.id } });
    expect(after?.odooSyncedAt).toBeNull();
    expect(after?.odooSyncError).toMatch(/not found/i);
  });

  it("recurring failure: each call sends a fresh email (parity with v1)", async () => {
    const { teams } = await seedBaseline();
    await seedAsbestosDefaultMapping();
    const asg = await seedAssignment({ teamId: teams.t1.id });

    mocks.createPartner.mockRejectedValue(new Error("network down"));

    await syncAssignmentToOdoo(asg.id);
    await syncAssignmentToOdoo(asg.id);

    expect(emailMocks.sendEmail).toHaveBeenCalledTimes(2);
    const after = await prisma.assignment.findUnique({ where: { id: asg.id } });
    expect(after?.odooSyncAttempts).toBe(2);
  });
});

describe("syncAssignmentToOdoo — line-step idempotency", () => {
  it("odooLinesSyncedAt set → step 4 skipped on retry", async () => {
    const { teams } = await seedBaseline();
    await seedAsbestosDefaultMapping();
    const asg = await seedAssignment({ teamId: teams.t1.id });
    // Simulate a partial run: contact + order already created, lines marked done.
    await prisma.assignment.update({
      where: { id: asg.id },
      data: {
        odooContactId: 11_001,
        odooOrderId: 22_001,
        odooLinesSyncedAt: new Date(),
      },
    });

    await syncAssignmentToOdoo(asg.id, { force: true });

    // Lines step skipped — no addSaleOrderLine call this time
    expect(mocks.addSaleOrderLine).not.toHaveBeenCalled();
    // Partner + order also skipped (ids already set), so this is a clean run
    expect(mocks.createPartner).not.toHaveBeenCalled();
    expect(mocks.createSaleOrder).not.toHaveBeenCalled();

    const after = await prisma.assignment.findUnique({ where: { id: asg.id } });
    expect(after?.odooSyncedAt).not.toBeNull();
  });
});
