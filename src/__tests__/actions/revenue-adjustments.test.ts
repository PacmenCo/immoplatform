import { describe, expect, it } from "vitest";
import {
  createRevenueAdjustmentInner,
  deleteRevenueAdjustmentInner,
} from "@/app/actions/revenueAdjustments";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import { seedBaseline } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";

// Manual accounting adjustments on the financial overview. The critical bits:
//   1. Admin only (v1 /overview route group is role:admin).
//   2. Amount is a decimal string in euros — normalized to signed cents.
//   3. Zero amounts and malformed numbers are rejected.
//   4. Rows link to a real team; invalid teamId fails cleanly.

setupTestDb();

describe("createRevenueAdjustmentInner — role gate", () => {
  it("admin allowed", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "Late invoice credit",
      amountEuros: "125",
    });
    expect(res.ok).toBe(true);
  });

  it("staff rejected — v1 parity (Platform /overview is role:admin)", async () => {
    const { staff, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(staff, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "Late invoice credit",
      amountEuros: "125",
    });
    expect(res).toEqual({
      ok: false,
      error: "Only admins can add revenue adjustments.",
    });
  });

  it("realtor rejected", async () => {
    const { realtor, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(realtor, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "trying to rewrite the books",
      amountEuros: "9999",
    });
    expect(res).toEqual({
      ok: false,
      error: "Only admins can add revenue adjustments.",
    });
  });

  it("freelancer rejected", async () => {
    const { freelancer, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(freelancer, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "x",
      amountEuros: "1",
    });
    expect(res.ok).toBe(false);
  });
});

describe("createRevenueAdjustmentInner — amount parsing", () => {
  it("positive integer → amountCents multiplied by 100", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "+€125",
      amountEuros: "125",
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const row = await prisma.revenueAdjustment.findUniqueOrThrow({
      where: { id: res.data.id },
    });
    expect(row.amountCents).toBe(12_500);
  });

  it("decimal with period (125.50) → 12550 cents", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "€125.50",
      amountEuros: "125.50",
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const row = await prisma.revenueAdjustment.findUniqueOrThrow({
      where: { id: res.data.id },
    });
    expect(row.amountCents).toBe(12_550);
  });

  it("decimal with COMMA (125,50) → 12550 cents (European format)", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "€125,50 BE format",
      amountEuros: "125,50",
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const row = await prisma.revenueAdjustment.findUniqueOrThrow({
      where: { id: res.data.id },
    });
    expect(row.amountCents).toBe(12_550);
  });

  it("negative value → stored as negative cents (deduction)", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "Refund",
      amountEuros: "-50.00",
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const row = await prisma.revenueAdjustment.findUniqueOrThrow({
      where: { id: res.data.id },
    });
    expect(row.amountCents).toBe(-5_000);
  });

  it("zero amount → rejected (pointless entry)", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "Zero",
      amountEuros: "0",
    });
    expect(res).toEqual({
      ok: false,
      error: "Amount must be a non-zero number.",
    });
  });

  it("malformed amount → zod rejects with format hint", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "Garbled input",
      amountEuros: "125.1234", // 4 decimals — outside the \d{1,2} allowance
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/number/i);
  });

  it("empty amount → 'Amount is required.'", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "Empty",
      amountEuros: "",
    });
    expect(res).toEqual({ ok: false, error: "Amount is required." });
  });
});

describe("createRevenueAdjustmentInner — other validation", () => {
  it("unknown team → 'Team not found.'", async () => {
    const { admin } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: "t_missing",
      year: 2026,
      month: 4,
      description: "x",
      amountEuros: "1",
    });
    expect(res).toEqual({ ok: false, error: "Team not found." });
  });

  it("month out of range (13) → zod rejects", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      month: 13,
      description: "x",
      amountEuros: "1",
    });
    expect(res.ok).toBe(false);
  });

  it("year out of range (1900) → zod rejects", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 1900,
      month: 4,
      description: "x",
      amountEuros: "1",
    });
    expect(res.ok).toBe(false);
  });

  it("empty description → 'Description is required.'", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "   ",
      amountEuros: "100",
    });
    expect(res).toEqual({ ok: false, error: "Description is required." });
  });

  it("description over 500 chars → rejected", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "x".repeat(501),
      amountEuros: "100",
    });
    expect(res.ok).toBe(false);
  });
});

describe("createRevenueAdjustmentInner — audit", () => {
  it("emits revenue_adjustment.created with team+amount metadata", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "+€75.25",
      amountEuros: "75.25",
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        actorId: admin.user.id,
        verb: "revenue_adjustment.created",
        objectId: res.data.id,
      },
      select: { metadata: true },
    });
    const meta = auditMeta(audit.metadata);
    expect(meta).toMatchObject({
      teamId: teams.t1.id,
      teamName: "Test Realtor Team",
      year: 2026,
      month: 4,
      amountCents: 7_525,
    });
  });
});

describe("deleteRevenueAdjustmentInner", () => {
  async function seedAdjustment() {
    const { admin, teams } = await seedBaseline();
    const res = await createRevenueAdjustmentInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      month: 4,
      description: "Credit",
      amountEuros: "100",
    });
    if (!res.ok || !res.data) throw new Error("expected id");
    return { id: res.data.id, admin };
  }

  it("admin deletes → row gone + audit emitted", async () => {
    const { id, admin } = await seedAdjustment();
    const res = await deleteRevenueAdjustmentInner(admin, id);
    expect(res).toEqual({ ok: true });
    const row = await prisma.revenueAdjustment.findUnique({ where: { id } });
    expect(row).toBeNull();
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        actorId: admin.user.id,
        verb: "revenue_adjustment.deleted",
        objectId: id,
      },
    });
    expect(audit).toBeTruthy();
  });

  it("realtor rejected", async () => {
    const { id } = await seedAdjustment();
    const realtor = await makeSession({
      role: "realtor",
      userId: "u_ra_outsider",
    });
    const res = await deleteRevenueAdjustmentInner(realtor, id);
    expect(res).toEqual({
      ok: false,
      error: "Only admins can remove revenue adjustments.",
    });
    const row = await prisma.revenueAdjustment.findUnique({ where: { id } });
    expect(row).not.toBeNull();
  });

  it("missing row → 'Adjustment not found.'", async () => {
    const { admin } = await seedBaseline();
    const res = await deleteRevenueAdjustmentInner(admin, "ra_missing");
    expect(res).toEqual({ ok: false, error: "Adjustment not found." });
  });

  it("deleting twice → second call returns 'Adjustment not found.' (non-idempotent by design)", async () => {
    const { id, admin } = await seedAdjustment();
    await deleteRevenueAdjustmentInner(admin, id);
    const second = await deleteRevenueAdjustmentInner(admin, id);
    expect(second).toEqual({ ok: false, error: "Adjustment not found." });
  });
});
