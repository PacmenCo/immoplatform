import { describe, expect, it } from "vitest";
import { loadFinancialOverview } from "@/lib/financial";
import type { Period } from "@/lib/period";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";

// Platform parity — port behavioral contract from:
//   Platform/app/Livewire/OverviewList.php
//
// FinancialSnapshot invariants:
//   1. Only `completed` assignments contribute to revenue.
//   2. Each assignment's totalCents respects discount + surcharge.
//   3. Per-service rollup uses proportional redistribution — per-line
//      contribution × (total / pre-discount). Bars sum back to grand total.
//   4. Commission accrued + paid numbers fold in.
//   5. Revenue adjustments (positive or negative) add to the month + team.
//   6. teamId filter narrows ALL the aggregates uniformly.

setupTestDb();

const Q1_2026: Period = { kind: "quarter", year: 2026, quarter: 1 };
const MAR_2026: Period = { kind: "month", year: 2026, month: 3 };
const Y_2026: Period = { kind: "year", year: 2026 };

/** Thin alias around seedAssignment so test signatures read as
 *  "completed on this date, with these services" — closer to the Platform-
 *  parity scenarios we're modeling. */
async function seedCompletedAssignment(opts: {
  id: string;
  teamId: string;
  completedAt: Date;
  services: Array<{ serviceKey: string; unitPriceCents: number }>;
  discountType?: "percentage" | "fixed" | null;
  discountValue?: number | null;
  areaM2?: number | null;
}) {
  return seedAssignment({
    id: opts.id,
    teamId: opts.teamId,
    status: "completed",
    propertyType: "apartment",
    services: opts.services,
    completedAt: opts.completedAt,
    discountType: opts.discountType,
    discountValue: opts.discountValue,
    areaM2: opts.areaM2,
  });
}

describe("loadFinancialOverview — status + date filtering", () => {
  it("EXCLUDES non-completed assignments from all aggregates", async () => {
    const { teams } = await seedBaseline();
    // scheduled — not completed, must NOT count
    await seedAssignment({
      id: "a_not_completed",
      teamId: teams.t1.id,
      status: "scheduled",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    const snap = await loadFinancialOverview(Q1_2026);
    expect(snap.totals.revenueCents).toBe(0);
    expect(snap.byTeam).toHaveLength(0);
    expect(snap.byService).toHaveLength(0);
  });

  it("EXCLUDES completed rows outside the period", async () => {
    const { teams } = await seedBaseline();
    await seedCompletedAssignment({
      id: "a_pre_q1",
      teamId: teams.t1.id,
      completedAt: new Date("2025-12-31T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    const snap = await loadFinancialOverview(Q1_2026);
    expect(snap.totals.revenueCents).toBe(0);
  });

  it("INCLUDES completed rows inside the period — totals match pricing", async () => {
    const { teams } = await seedBaseline();
    await seedCompletedAssignment({
      id: "a_in_q1",
      teamId: teams.t1.id,
      completedAt: new Date("2026-02-15T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    const snap = await loadFinancialOverview(Q1_2026);
    expect(snap.totals.revenueCents).toBe(25_000);
    expect(snap.totals.servicesRevenueCents).toBe(25_000);
    expect(snap.totals.adjustmentCents).toBe(0);
    expect(snap.totals.assignmentCount).toBe(1);
  });
});

describe("loadFinancialOverview — pricing integration", () => {
  it("applies percentage discount to revenue total", async () => {
    const { teams } = await seedBaseline();
    await seedCompletedAssignment({
      id: "a_discounted",
      teamId: teams.t1.id,
      completedAt: new Date("2026-02-15T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
      discountType: "percentage",
      discountValue: 2000, // 20% off
    });
    const snap = await loadFinancialOverview(Q1_2026);
    expect(snap.totals.revenueCents).toBe(20_000); // 25_000 × 80%
  });

  it("applies areaM2 surcharge", async () => {
    const { teams } = await seedBaseline();
    // 401 m² → 2 surcharge blocks × 20% = 40% → 25_000 + 10_000 = 35_000
    await seedCompletedAssignment({
      id: "a_surcharged",
      teamId: teams.t1.id,
      completedAt: new Date("2026-02-15T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
      areaM2: 401,
    });
    const snap = await loadFinancialOverview(Q1_2026);
    expect(snap.totals.revenueCents).toBe(35_000);
  });

  it("per-service bars redistribute proportionally after discount (sum back to total)", async () => {
    const { teams } = await seedBaseline();
    await seedCompletedAssignment({
      id: "a_proportional",
      teamId: teams.t1.id,
      completedAt: new Date("2026-02-15T00:00:00Z"),
      services: [
        { serviceKey: "asbestos", unitPriceCents: 15_000 },
        { serviceKey: "epc", unitPriceCents: 5_000 },
      ],
      discountType: "percentage",
      discountValue: 5000, // 50% → total is 10_000
    });
    const snap = await loadFinancialOverview(Q1_2026);
    expect(snap.totals.revenueCents).toBe(10_000);
    // asbestos was 15000/20000 = 75 % of pre; 50 % of 15000 = 7500
    // epc was 5000/20000 = 25 %; 50 % of 5000 = 2500
    const asb = snap.byService.find((b) => b.serviceKey === "asbestos")?.revenueCents;
    const epc = snap.byService.find((b) => b.serviceKey === "epc")?.revenueCents;
    expect(asb).toBe(7_500);
    expect(epc).toBe(2_500);
    expect((asb ?? 0) + (epc ?? 0)).toBe(snap.totals.servicesRevenueCents);
  });
});

describe("loadFinancialOverview — per-team rollup", () => {
  it("each team gets a row with revenue + assignment count", async () => {
    const { teams } = await seedBaseline();
    await seedCompletedAssignment({
      id: "a_team1_feb",
      teamId: teams.t1.id,
      completedAt: new Date("2026-02-10T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    await seedCompletedAssignment({
      id: "a_team1_mar",
      teamId: teams.t1.id,
      completedAt: new Date("2026-03-15T00:00:00Z"),
      services: [{ serviceKey: "epc", unitPriceCents: 15_000 }],
    });
    await seedCompletedAssignment({
      id: "a_team2_jan",
      teamId: teams.t2.id,
      completedAt: new Date("2026-01-05T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    const snap = await loadFinancialOverview(Q1_2026);
    const t1Row = snap.byTeam.find((r) => r.teamId === teams.t1.id);
    const t2Row = snap.byTeam.find((r) => r.teamId === teams.t2.id);
    expect(t1Row?.revenueCents).toBe(40_000);
    expect(t1Row?.assignmentCount).toBe(2);
    expect(t2Row?.revenueCents).toBe(25_000);
    expect(t2Row?.assignmentCount).toBe(1);
  });

  it("sorts byTeam descending on revenue", async () => {
    const { teams } = await seedBaseline();
    await seedCompletedAssignment({
      id: "a_t1_big",
      teamId: teams.t1.id,
      completedAt: new Date("2026-02-10T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    await seedCompletedAssignment({
      id: "a_t2_small",
      teamId: teams.t2.id,
      completedAt: new Date("2026-01-05T00:00:00Z"),
      services: [{ serviceKey: "epc", unitPriceCents: 15_000 }],
    });
    const snap = await loadFinancialOverview(Q1_2026);
    expect(snap.byTeam[0].teamId).toBe(teams.t1.id); // 25k > 15k
    expect(snap.byTeam[1].teamId).toBe(teams.t2.id);
  });
});

describe("loadFinancialOverview — commission rollups", () => {
  it("accrued commission per team is computed from lines in-period", async () => {
    const { teams } = await seedBaseline();
    await seedCompletedAssignment({
      id: "a_with_commission_line",
      teamId: teams.t1.id,
      completedAt: new Date("2026-02-10T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    await prisma.assignmentCommission.create({
      data: {
        assignmentId: "a_with_commission_line",
        teamId: teams.t1.id,
        assignmentTotalCents: 25_000,
        commissionType: "percentage",
        commissionValue: 1500,
        commissionAmountCents: 3_750,
        computedAt: new Date("2026-02-10T00:00:00Z"),
      },
    });
    const snap = await loadFinancialOverview(Q1_2026);
    const t1 = snap.byTeam.find((r) => r.teamId === teams.t1.id);
    expect(t1?.commissionAccruedCents).toBe(3_750);
    expect(snap.totals.commissionAccruedCents).toBe(3_750);
  });

  it("paid commission per team comes from CommissionPayout rows in-period", async () => {
    const { admin, teams } = await seedBaseline();
    await seedCompletedAssignment({
      id: "a_paid_path",
      teamId: teams.t1.id,
      completedAt: new Date("2026-02-10T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    await prisma.assignmentCommission.create({
      data: {
        assignmentId: "a_paid_path",
        teamId: teams.t1.id,
        assignmentTotalCents: 25_000,
        commissionType: "percentage",
        commissionValue: 1500,
        commissionAmountCents: 3_750,
        computedAt: new Date("2026-02-10T00:00:00Z"),
      },
    });
    await prisma.commissionPayout.create({
      data: {
        teamId: teams.t1.id,
        year: 2026,
        quarter: 1,
        amountCents: 3_750,
        paidAt: new Date("2026-03-31T23:00:00Z"),
        paidById: admin.user.id,
      },
    });
    const snap = await loadFinancialOverview(Q1_2026);
    expect(snap.totals.commissionPaidCents).toBe(3_750);
  });

  it("payouts OUTSIDE the period window don't leak into the paid total", async () => {
    const { admin, teams } = await seedBaseline();
    await prisma.commissionPayout.create({
      data: {
        teamId: teams.t1.id,
        year: 2025,
        quarter: 4,
        amountCents: 100_000, // way outside Q1 2026
        paidAt: new Date("2025-12-15T12:00:00Z"),
        paidById: admin.user.id,
      },
    });
    const snap = await loadFinancialOverview(Q1_2026);
    expect(snap.totals.commissionPaidCents).toBe(0);
  });
});

describe("loadFinancialOverview — revenue adjustments", () => {
  it("positive adjustment lifts team + total revenue for the month", async () => {
    const { admin, teams } = await seedBaseline();
    await prisma.revenueAdjustment.create({
      data: {
        teamId: teams.t1.id,
        year: 2026,
        month: 2,
        description: "Rebate credit",
        amountCents: 5_000,
        createdById: admin.user.id,
      },
    });
    const snap = await loadFinancialOverview(Q1_2026);
    const t1 = snap.byTeam.find((r) => r.teamId === teams.t1.id);
    expect(t1?.adjustmentCents).toBe(5_000);
    expect(t1?.revenueCents).toBe(5_000);
    expect(snap.totals.adjustmentCents).toBe(5_000);
    expect(snap.totals.revenueCents).toBe(5_000);
  });

  it("negative adjustment (deduction) reduces team revenue", async () => {
    const { admin, teams } = await seedBaseline();
    await seedCompletedAssignment({
      id: "a_with_deduction",
      teamId: teams.t1.id,
      completedAt: new Date("2026-02-10T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    await prisma.revenueAdjustment.create({
      data: {
        teamId: teams.t1.id,
        year: 2026,
        month: 2,
        description: "Refund",
        amountCents: -10_000,
        createdById: admin.user.id,
      },
    });
    const snap = await loadFinancialOverview(Q1_2026);
    const t1 = snap.byTeam.find((r) => r.teamId === teams.t1.id);
    expect(t1?.revenueCents).toBe(15_000); // 25_000 - 10_000
    expect(t1?.adjustmentCents).toBe(-10_000);
  });

  it("adjustments OUTSIDE focus period don't appear in `adjustments` list", async () => {
    const { admin, teams } = await seedBaseline();
    // This adjustment is in April (Q2) — must not show up when we ask Q1.
    await prisma.revenueAdjustment.create({
      data: {
        teamId: teams.t1.id,
        year: 2026,
        month: 4,
        description: "Q2 adjustment",
        amountCents: 1_000,
        createdById: admin.user.id,
      },
    });
    const snap = await loadFinancialOverview(Q1_2026);
    expect(snap.adjustments).toHaveLength(0);
    expect(snap.totals.adjustmentCents).toBe(0);
  });
});

describe("loadFinancialOverview — period variants", () => {
  it("month period → only the single month contributes to totals", async () => {
    const { teams } = await seedBaseline();
    // Feb assignment — in Q1 but NOT in Mar
    await seedCompletedAssignment({
      id: "a_feb_only",
      teamId: teams.t1.id,
      completedAt: new Date("2026-02-10T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    // Mar assignment — in both Q1 AND Mar
    await seedCompletedAssignment({
      id: "a_mar_only",
      teamId: teams.t1.id,
      completedAt: new Date("2026-03-15T00:00:00Z"),
      services: [{ serviceKey: "epc", unitPriceCents: 15_000 }],
    });
    const mar = await loadFinancialOverview(MAR_2026);
    expect(mar.totals.revenueCents).toBe(15_000);
    expect(mar.totals.assignmentCount).toBe(1);

    const q1 = await loadFinancialOverview(Q1_2026);
    expect(q1.totals.revenueCents).toBe(40_000);
    expect(q1.totals.assignmentCount).toBe(2);
  });

  it("year period → all 12 months contribute", async () => {
    const { teams } = await seedBaseline();
    await seedCompletedAssignment({
      id: "a_jan_2026",
      teamId: teams.t1.id,
      completedAt: new Date("2026-01-10T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 10_000 }],
    });
    await seedCompletedAssignment({
      id: "a_aug_2026",
      teamId: teams.t1.id,
      completedAt: new Date("2026-08-20T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 30_000 }],
    });
    const snap = await loadFinancialOverview(Y_2026);
    expect(snap.totals.revenueCents).toBe(40_000);
    expect(snap.totals.assignmentCount).toBe(2);
  });
});

describe("loadFinancialOverview — teamId filter", () => {
  it("scopes assignments + commissions + adjustments to the team", async () => {
    const { admin, teams } = await seedBaseline();
    // Two completed rows — one per team — both in Q1
    await seedCompletedAssignment({
      id: "a_t1_scope",
      teamId: teams.t1.id,
      completedAt: new Date("2026-02-01T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    await seedCompletedAssignment({
      id: "a_t2_scope",
      teamId: teams.t2.id,
      completedAt: new Date("2026-02-01T00:00:00Z"),
      services: [{ serviceKey: "asbestos", unitPriceCents: 50_000 }],
    });
    await prisma.revenueAdjustment.create({
      data: {
        teamId: teams.t2.id,
        year: 2026,
        month: 2,
        description: "t2-only rebate",
        amountCents: 9_999,
        createdById: admin.user.id,
      },
    });
    const snap = await loadFinancialOverview(Q1_2026, { teamId: teams.t1.id });
    // Only t1's row counts — the 50k from t2 + the 9_999 t2 rebate are excluded
    expect(snap.totals.revenueCents).toBe(25_000);
    expect(snap.byTeam.every((r) => r.teamId === teams.t1.id)).toBe(true);
    expect(snap.totals.adjustmentCents).toBe(0);
  });
});

describe("loadFinancialOverview — shape", () => {
  it("allTeams contains all team rows alphabetically (regardless of activity)", async () => {
    await seedBaseline();
    const snap = await loadFinancialOverview(Q1_2026);
    expect(snap.allTeams.map((t) => t.name)).toEqual([
      "Spare Team",
      "Test Realtor Team",
    ]);
  });

  it("byMonth array covers the chart axis even when nothing happened (zeros)", async () => {
    await seedBaseline();
    const snap = await loadFinancialOverview(Q1_2026);
    expect(snap.byMonth.length).toBeGreaterThan(0);
    for (const m of snap.byMonth) expect(m.revenueCents).toBe(0);
  });
});
