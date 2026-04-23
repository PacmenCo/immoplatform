import { describe, expect, it } from "vitest";
import { applyCommission, quarterlyTotalsByTeam } from "@/lib/commission";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedAssignment, seedBaseline, seedTeam } from "../_helpers/fixtures";

// Platform parity — ports behavioral contract from:
//   Platform/app/Services/CommissionService.php::apply
//   Platform/tests/Feature/CommissionServiceTest.php
//
// Integration-tier commission coverage. The pure math lives in
// src/__tests__/lib/commission.test.ts — here we exercise applyCommission
// end-to-end against a real Prisma DB: eligibility gating, idempotent upsert,
// per-quarter aggregation.

setupTestDb();

describe("applyCommission — eligibility", () => {
  it("asbestos + apartment + team with commission config → writes a row", async () => {
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_eligible",
      teamId: teams.t1.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    const result = await applyCommission(asg.id);
    expect(result).not.toBeNull();
    expect(result?.amountCents).toBe(3_750); // 15 % of 25_000 cents

    const row = await prisma.assignmentCommission.findUnique({
      where: { assignmentId: asg.id },
      select: {
        teamId: true,
        commissionType: true,
        commissionValue: true,
        commissionAmountCents: true,
        assignmentTotalCents: true,
      },
    });
    expect(row).toEqual({
      teamId: teams.t1.id,
      commissionType: "percentage",
      commissionValue: 1500,
      commissionAmountCents: 3_750,
      assignmentTotalCents: 25_000,
    });
  });

  it("studio_room (excluded) → returns null and writes no row", async () => {
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_studio_room",
      teamId: teams.t1.id,
      propertyType: "studio_room",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    const result = await applyCommission(asg.id);
    expect(result).toBeNull();
    const row = await prisma.assignmentCommission.findUnique({
      where: { assignmentId: asg.id },
    });
    expect(row).toBeNull();
  });

  it("no asbestos service → returns null and writes no row", async () => {
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_no_asbestos",
      teamId: teams.t1.id,
      propertyType: "apartment",
      services: [{ serviceKey: "epc", unitPriceCents: 15_000 }],
    });
    const result = await applyCommission(asg.id);
    expect(result).toBeNull();
  });

  it("team has no commission config → returns null (team t2 has commission unset)", async () => {
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_no_commission_config",
      teamId: teams.t2.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    const result = await applyCommission(asg.id);
    expect(result).toBeNull();
  });

  it("missing team → returns null (no FK = no commission)", async () => {
    await seedBaseline();
    const asg = await seedAssignment({
      id: "a_teamless",
      teamId: null,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    const result = await applyCommission(asg.id);
    expect(result).toBeNull();
  });
});

describe("applyCommission — idempotency", () => {
  it("second call with unchanged inputs produces the same row (upsert)", async () => {
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_idempotent",
      teamId: teams.t1.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    const first = await applyCommission(asg.id);
    const second = await applyCommission(asg.id);
    expect(second?.id).toBe(first?.id);
    expect(second?.amountCents).toBe(first?.amountCents);
    const count = await prisma.assignmentCommission.count({
      where: { assignmentId: asg.id },
    });
    expect(count).toBe(1);
  });

  it("team commissionValue change + re-apply → row re-priced", async () => {
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_reprice",
      teamId: teams.t1.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    await applyCommission(asg.id);

    // Bump team to 20% — re-apply should rewrite the row with the new rate.
    await prisma.team.update({
      where: { id: teams.t1.id },
      data: { commissionValue: 2000 },
    });
    const res = await applyCommission(asg.id);
    expect(res?.amountCents).toBe(5_000); // 20% of 25_000
    const row = await prisma.assignmentCommission.findUnique({
      where: { assignmentId: asg.id },
      select: { commissionValue: true, commissionAmountCents: true },
    });
    expect(row).toEqual({ commissionValue: 2000, commissionAmountCents: 5_000 });
  });
});

describe("applyCommission — pricing integration", () => {
  it("discount on assignment flows into commission base (post-discount total)", async () => {
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_with_discount",
      teamId: teams.t1.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    // 20% percentage discount → 25_000 * 0.80 = 20_000 base → 15% = 3_000
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { discountType: "percentage", discountValue: 2000 },
    });
    const res = await applyCommission(asg.id);
    expect(res?.amountCents).toBe(3_000);
    const row = await prisma.assignmentCommission.findUnique({
      where: { assignmentId: asg.id },
      select: { assignmentTotalCents: true, commissionAmountCents: true },
    });
    expect(row).toEqual({
      assignmentTotalCents: 20_000,
      commissionAmountCents: 3_000,
    });
  });

  it("areaM2 surcharge also flows into the commission base", async () => {
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_large_surcharge",
      teamId: teams.t1.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    // areaM2 = 401 → 2 blocks × 20% = 40% surcharge
    // 25_000 base + 10_000 surcharge = 35_000 → 15% = 5_250
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { areaM2: 401 },
    });
    const res = await applyCommission(asg.id);
    expect(res?.amountCents).toBe(5_250);
    const row = await prisma.assignmentCommission.findUnique({
      where: { assignmentId: asg.id },
      select: { assignmentTotalCents: true },
    });
    expect(row?.assignmentTotalCents).toBe(35_000);
  });
});

describe("quarterlyTotalsByTeam — aggregation", () => {
  it("sums commission rows per team within the quarter window", async () => {
    const { teams } = await seedBaseline();
    await seedTeam("t_test_3", "Third Team", {
      commissionType: "percentage",
      commissionValue: 1000, // 10 %
    });

    // Two rows in Q1 2026 for team t1, one for t_test_3. Stamp `computedAt`
    // directly so the group-by filter deterministically captures them.
    for (const [id, teamId, total, amount] of [
      ["a_q1_a", teams.t1.id, 25_000, 3_750],
      ["a_q1_b", teams.t1.id, 10_000, 1_500],
      ["a_q1_c", "t_test_3", 50_000, 5_000],
    ] as const) {
      await seedAssignment({
        id,
        teamId,
        status: "completed",
        propertyType: "apartment",
        services: [{ serviceKey: "asbestos", unitPriceCents: total }],
      });
      await prisma.assignmentCommission.create({
        data: {
          assignmentId: id,
          teamId,
          assignmentTotalCents: total,
          commissionType: "percentage",
          commissionValue: teamId === teams.t1.id ? 1500 : 1000,
          commissionAmountCents: amount,
          computedAt: new Date("2026-02-15T12:00:00Z"),
        },
      });
    }

    // One more row OUTSIDE the Q1 window (Q4 2025) — must be excluded.
    const outsider = await seedAssignment({
      id: "a_q4_2025",
      teamId: teams.t1.id,
      status: "completed",
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });
    await prisma.assignmentCommission.create({
      data: {
        assignmentId: outsider.id,
        teamId: teams.t1.id,
        assignmentTotalCents: 25_000,
        commissionType: "percentage",
        commissionValue: 1500,
        commissionAmountCents: 3_750,
        computedAt: new Date("2025-12-15T12:00:00Z"),
      },
    });

    const rows = await quarterlyTotalsByTeam(2026, 1);
    const byId = Object.fromEntries(rows.map((r) => [r.teamId, r]));
    expect(byId[teams.t1.id]?.totalCents).toBe(5_250); // 3_750 + 1_500
    expect(byId[teams.t1.id]?.lineCount).toBe(2);
    expect(byId["t_test_3"]?.totalCents).toBe(5_000);
    expect(byId["t_test_3"]?.lineCount).toBe(1);
  });
});
