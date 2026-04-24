import { describe, expect, it } from "vitest";
import {
  markCommissionQuarterPaidInner,
  undoCommissionQuarterPaidInner,
} from "@/app/actions/commissions";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import { seedAssignmentWithCommission, seedBaseline } from "../_helpers/fixtures";

// Platform parity — CommissionPayout semantics:
//   - admin/staff only (canMarkCommissionPaid)
//   - idempotent per (teamId, year, quarter) via unique constraint
//   - "paid zero" blocked when no commission exists AND no prior payout row
//   - undo deletes the row; re-mark starts from today's total

setupTestDb();

const seedCommissionInQuarter = seedAssignmentWithCommission;

describe("markCommissionQuarterPaidInner — role gate", () => {
  it("admin is allowed", async () => {
    const { admin, teams } = await seedBaseline();
    await seedCommissionInQuarter({
      id: "a_q1_2026_admin",
      teamId: teams.t1.id,
      amountCents: 5_000,
      computedAt: new Date("2026-02-10T12:00:00Z"),
    });
    const res = await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    expect(res).toEqual({ ok: true });
  });

  it("staff REJECTED — v1 parity (Platform /overview is role:admin)", async () => {
    const { staff, teams } = await seedBaseline();
    const res = await markCommissionQuarterPaidInner(staff, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    expect(res).toEqual({
      ok: false,
      error: "Only admins can mark commissions paid.",
    });
  });

  it("realtor REJECTED (not allowed to rewrite the ledger)", async () => {
    const { realtor, teams } = await seedBaseline();
    const res = await markCommissionQuarterPaidInner(realtor, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    expect(res).toEqual({
      ok: false,
      error: "Only admins can mark commissions paid.",
    });
  });

  it("freelancer REJECTED", async () => {
    const { freelancer, teams } = await seedBaseline();
    const res = await markCommissionQuarterPaidInner(freelancer, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    expect(res.ok).toBe(false);
  });
});

describe("markCommissionQuarterPaidInner — input validation", () => {
  it("unknown team → 'Team not found.'", async () => {
    const { admin } = await seedBaseline();
    const res = await markCommissionQuarterPaidInner(admin, {
      teamId: "t_does_not_exist",
      year: 2026,
      quarter: 1,
    });
    expect(res).toEqual({ ok: false, error: "Team not found." });
  });

  it("year out of sane range → 'Invalid year.'", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 1999,
      quarter: 1,
    });
    expect(res).toEqual({ ok: false, error: "Invalid year." });
  });

  it("quarter < 1 → 'Invalid quarter.'", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 0,
    });
    expect(res).toEqual({ ok: false, error: "Invalid quarter." });
  });

  it("quarter > 4 → 'Invalid quarter.'", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 5,
    });
    expect(res).toEqual({ ok: false, error: "Invalid quarter." });
  });
});

describe("markCommissionQuarterPaidInner — accrual snapshot + ledger row", () => {
  it("writes amountCents + paidById snapshot on first call", async () => {
    const { admin, teams } = await seedBaseline();
    await seedCommissionInQuarter({
      id: "a_q1_first_pay",
      teamId: teams.t1.id,
      amountCents: 7_500,
      computedAt: new Date("2026-03-01T12:00:00Z"),
    });
    await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    const payout = await prisma.commissionPayout.findUniqueOrThrow({
      where: {
        teamId_year_quarter: { teamId: teams.t1.id, year: 2026, quarter: 1 },
      },
      select: { amountCents: true, paidById: true, year: true, quarter: true },
    });
    expect(payout).toEqual({
      amountCents: 7_500,
      paidById: admin.user.id,
      year: 2026,
      quarter: 1,
    });
  });

  it("sums across multiple commission lines in the same quarter", async () => {
    const { admin, teams } = await seedBaseline();
    await seedCommissionInQuarter({
      id: "a_q1_line_a",
      teamId: teams.t1.id,
      amountCents: 2_000,
      computedAt: new Date("2026-01-10T12:00:00Z"),
    });
    await seedCommissionInQuarter({
      id: "a_q1_line_b",
      teamId: teams.t1.id,
      amountCents: 3_500,
      computedAt: new Date("2026-02-15T12:00:00Z"),
    });
    await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    const payout = await prisma.commissionPayout.findUniqueOrThrow({
      where: {
        teamId_year_quarter: { teamId: teams.t1.id, year: 2026, quarter: 1 },
      },
      select: { amountCents: true },
    });
    expect(payout.amountCents).toBe(5_500);
  });

  it("excludes commission rows from OTHER quarters", async () => {
    const { admin, teams } = await seedBaseline();
    await seedCommissionInQuarter({
      id: "a_q1_included",
      teamId: teams.t1.id,
      amountCents: 1_000,
      computedAt: new Date("2026-03-30T23:59:00Z"),
    });
    // One in Q4 2025 — must not leak in.
    await seedCommissionInQuarter({
      id: "a_q4_2025_excluded",
      teamId: teams.t1.id,
      amountCents: 9_999,
      computedAt: new Date("2025-12-30T12:00:00Z"),
    });
    // One in Q2 2026 — must not leak in.
    await seedCommissionInQuarter({
      id: "a_q2_2026_excluded",
      teamId: teams.t1.id,
      amountCents: 8_888,
      computedAt: new Date("2026-04-01T00:00:00Z"),
    });
    await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    const payout = await prisma.commissionPayout.findUniqueOrThrow({
      where: {
        teamId_year_quarter: { teamId: teams.t1.id, year: 2026, quarter: 1 },
      },
    });
    expect(payout.amountCents).toBe(1_000);
  });

  it("isolates teams — paying Q1 for team A does not touch team B", async () => {
    const { admin, teams } = await seedBaseline();
    await seedCommissionInQuarter({
      id: "a_q1_team_a",
      teamId: teams.t1.id,
      amountCents: 1_000,
      computedAt: new Date("2026-02-10T12:00:00Z"),
    });
    await seedCommissionInQuarter({
      id: "a_q1_team_b",
      teamId: teams.t2.id,
      amountCents: 2_000,
      computedAt: new Date("2026-02-10T12:00:00Z"),
    });
    await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    const paidForT1 = await prisma.commissionPayout.findUnique({
      where: {
        teamId_year_quarter: { teamId: teams.t1.id, year: 2026, quarter: 1 },
      },
    });
    const paidForT2 = await prisma.commissionPayout.findUnique({
      where: {
        teamId_year_quarter: { teamId: teams.t2.id, year: 2026, quarter: 1 },
      },
    });
    expect(paidForT1?.amountCents).toBe(1_000);
    expect(paidForT2).toBeNull();
  });
});

describe("markCommissionQuarterPaidInner — idempotency + zero-block", () => {
  it("second call upserts the same row (no duplicates)", async () => {
    const { admin, teams } = await seedBaseline();
    await seedCommissionInQuarter({
      id: "a_q1_idem_a",
      teamId: teams.t1.id,
      amountCents: 5_000,
      computedAt: new Date("2026-02-10T12:00:00Z"),
    });
    await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    // Add a new commission row, then re-mark — total should jump to reflect
    // today's accrual.
    await seedCommissionInQuarter({
      id: "a_q1_idem_b",
      teamId: teams.t1.id,
      amountCents: 3_000,
      computedAt: new Date("2026-02-20T12:00:00Z"),
    });
    await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    const rows = await prisma.commissionPayout.findMany({
      where: { teamId: teams.t1.id, year: 2026, quarter: 1 },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(8_000);
  });

  it("no commission + no existing payout → rejects with 'Nothing to mark paid'", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    expect(res).toEqual({
      ok: false,
      error:
        "Nothing to mark paid — this team has no commission this quarter.",
    });
    const count = await prisma.commissionPayout.count();
    expect(count).toBe(0);
  });

  it("no commission BUT existing payout → re-mark is allowed (refresh path)", async () => {
    const { admin, teams } = await seedBaseline();
    // Seed a payout without any commission rows — simulates the refresh case
    // where all underlying commissions were unwound but the payout remains.
    await prisma.commissionPayout.create({
      data: {
        teamId: teams.t1.id,
        year: 2026,
        quarter: 1,
        amountCents: 0,
        paidById: admin.user.id,
      },
    });
    const res = await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    expect(res).toEqual({ ok: true });
  });
});

describe("markCommissionQuarterPaidInner — audit", () => {
  it("emits commission.quarter_paid with year/quarter/amountCents/teamName", async () => {
    const { admin, teams } = await seedBaseline();
    await seedCommissionInQuarter({
      id: "a_q1_audit",
      teamId: teams.t1.id,
      amountCents: 4_200,
      computedAt: new Date("2026-02-10T12:00:00Z"),
    });
    await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        actorId: admin.user.id,
        verb: "commission.quarter_paid",
        objectId: teams.t1.id,
      },
      select: { metadata: true },
    });
    const meta = auditMeta(audit.metadata);
    expect(meta).toEqual({
      year: 2026,
      quarter: 1,
      amountCents: 4_200,
      teamName: "Test Realtor Team",
    });
  });
});

describe("undoCommissionQuarterPaidInner", () => {
  it("deletes the payout row + emits commission.quarter_unpaid audit", async () => {
    const { admin, teams } = await seedBaseline();
    await seedCommissionInQuarter({
      id: "a_q1_undo",
      teamId: teams.t1.id,
      amountCents: 1_500,
      computedAt: new Date("2026-02-10T12:00:00Z"),
    });
    await markCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    const res = await undoCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    expect(res).toEqual({ ok: true });

    const row = await prisma.commissionPayout.findUnique({
      where: {
        teamId_year_quarter: { teamId: teams.t1.id, year: 2026, quarter: 1 },
      },
    });
    expect(row).toBeNull();

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        actorId: admin.user.id,
        verb: "commission.quarter_unpaid",
        objectId: teams.t1.id,
      },
    });
    expect(audit).toBeTruthy();
  });

  it("undoing a non-existent payout is a no-op (ok + no audit)", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await undoCommissionQuarterPaidInner(admin, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    expect(res).toEqual({ ok: true });
    const audits = await prisma.auditLog.count({
      where: { verb: "commission.quarter_unpaid" },
    });
    expect(audits).toBe(0);
  });

  it("realtor REJECTED (permission gate)", async () => {
    const { realtor, teams } = await seedBaseline();
    const res = await undoCommissionQuarterPaidInner(realtor, {
      teamId: teams.t1.id,
      year: 2026,
      quarter: 1,
    });
    expect(res).toEqual({
      ok: false,
      error: "Only admins can undo commission payouts.",
    });
  });
});
