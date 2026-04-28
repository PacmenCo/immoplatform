import { describe, expect, it } from "vitest";
import { loadAssignmentPricing } from "@/lib/pricing";
import { applyCommission } from "@/lib/commission";
import { loadFinancialOverview } from "@/lib/financial";
import { setupTestDb } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";

// Regression guard for a known live bug, caught by Phase-9 batch-9 flow-parity
// test (CC todo_1777231736634_234eb60f). Tracked separately in CC todo
// todo_1777232831899_36260853.
//
// Bug: Assignment.quantity is stored from the form but never read by the
// downstream pricing/financial/commission engines. Three call sites hardcode
// `quantity: 1`:
//   - src/lib/pricing.ts:191      (loadAssignmentPricing → detail-tile total)
//   - src/lib/financial.ts:90     (priceAssignment → revenue rollups)
//   - src/lib/commission.ts:288   (totalFromAssignment → commission base)
//
// computePricing itself respects `quantity` correctly — pricing.test.ts proves
// that. The bug is purely the wire-up: the column gets persisted, then dropped
// on every read path.
//
// All assertions below describe the *correct* behavior. They are wrapped in
// `it.fails` so the suite stays green today; the moment the bug is fixed,
// vitest will flag these as unexpectedly-passing — at which point flip them
// from `it.fails` to `it`.

setupTestDb();

describe("Assignment.quantity propagates to loadAssignmentPricing", () => {
  it("multiplies line totals by Assignment.quantity", async () => {
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_qty_pricing",
      teamId: teams.t1.id,
      quantity: 2,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    const pricing = await loadAssignmentPricing(asg.id);
    expect(pricing).not.toBeNull();
    // 25 000c × qty 2, no surcharge, no discount → 50 000c.
    expect(pricing?.totalCents).toBe(50_000);
  });

  it("stacks correctly with the 300 m² area surcharge", async () => {
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_qty_surcharge",
      teamId: teams.t1.id,
      quantity: 2,
      areaM2: 550,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    const pricing = await loadAssignmentPricing(asg.id);
    expect(pricing).not.toBeNull();
    // base 25 000c × 2 = 50 000c.
    // surcharge: ceil((550-300)/100) = 3 blocks × 2000bps = 6000bps = ×1.6.
    // total: 50 000 × 1.6 = 80 000c.
    expect(pricing?.totalCents).toBe(80_000);
  });

  it("quantity = 1 is unaffected (sanity floor — also passes today)", async () => {
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_qty_one",
      teamId: teams.t1.id,
      quantity: 1,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    const pricing = await loadAssignmentPricing(asg.id);
    expect(pricing?.totalCents).toBe(25_000);
  });
});

describe("Assignment.quantity propagates to applyCommission", () => {
  it("commission is computed off quantity-aware total", async () => {
    const { teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_qty_commission",
      teamId: teams.t1.id,
      status: "completed",
      completedAt: new Date(),
      quantity: 2,
      // asbestos is in COMMISSION_ELIGIBLE_SERVICES; apartment is not in
      // EXCLUDED_PROPERTY_TYPES — eligible.
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    const result = await applyCommission(asg.id);
    expect(result).not.toBeNull();
    // assignment total: 50 000c (qty 2 × 25 000c).
    // team t1: percentage commission 1500 bps = 15%.
    // expected commission: 50 000 × 0.15 = 7 500c.
    expect(result?.amountCents).toBe(7_500);
  });
});

describe("Assignment.quantity propagates to loadFinancialOverview", () => {
  it("revenue rollup reflects Assignment.quantity", async () => {
    const { teams } = await seedBaseline();
    const completedAt = new Date(Date.UTC(2026, 4, 15)); // 2026-05-15 UTC
    await seedAssignment({
      id: "a_qty_financial",
      teamId: teams.t1.id,
      status: "completed",
      completedAt,
      quantity: 2,
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    const overview = await loadFinancialOverview({
      kind: "month",
      year: 2026,
      month: 5,
    });
    // qty 2 × 25 000c = 50 000c (no surcharge, no discount).
    expect(overview.totals.servicesRevenueCents).toBe(50_000);
  });
});
