import { describe, it, expect } from "vitest";
import {
  computeCommission,
  isAssignmentCommissionEligible,
  isCommissionType,
  EXCLUDED_PROPERTY_TYPES,
  COMMISSION_ELIGIBLE_SERVICES,
  MAX_COMMISSION_PERCENTAGE_BPS,
  COMMISSION_TYPES,
} from "@/lib/commission";

// Platform parity — ports assertions from:
//   Platform/app/Services/CommissionService.php (calculate + eligibility)
//   Platform/tests/Feature/CommissionServiceTest.php
// `applyCommission` + `quarterlyTotalsByTeam` are DB-coupled and land in
// Phase 3 (integration tier).

describe("constants", () => {
  it("EXCLUDED_PROPERTY_TYPES: studio_room only (Platform: Studentenkamer)", () => {
    expect(EXCLUDED_PROPERTY_TYPES.has("studio_room")).toBe(true);
    expect(EXCLUDED_PROPERTY_TYPES.size).toBe(1);
  });

  it("COMMISSION_ELIGIBLE_SERVICES: asbestos only (Platform: service_asbestos)", () => {
    expect(COMMISSION_ELIGIBLE_SERVICES.has("asbestos")).toBe(true);
    expect(COMMISSION_ELIGIBLE_SERVICES.size).toBe(1);
  });

  it("Percentage ceiling is 10_000 bps (100%)", () => {
    expect(MAX_COMMISSION_PERCENTAGE_BPS).toBe(10_000);
  });

  it("Commission types are exactly {percentage, fixed}", () => {
    expect([...COMMISSION_TYPES]).toEqual(["percentage", "fixed"]);
  });
});

describe("isCommissionType", () => {
  it("accepts percentage / fixed", () => {
    expect(isCommissionType("percentage")).toBe(true);
    expect(isCommissionType("fixed")).toBe(true);
  });
  it("rejects other values", () => {
    expect(isCommissionType("hybrid")).toBe(false);
    expect(isCommissionType(null)).toBe(false);
    expect(isCommissionType("")).toBe(false);
    expect(isCommissionType(1500)).toBe(false);
  });
});

describe("isAssignmentCommissionEligible", () => {
  it("asbestos service + any non-excluded property → eligible", () => {
    expect(
      isAssignmentCommissionEligible({
        propertyType: "apartment",
        services: [{ serviceKey: "asbestos" }],
      }),
    ).toBe(true);
  });

  it("asbestos + studio_room → NOT eligible (Platform excludes Studentenkamer)", () => {
    expect(
      isAssignmentCommissionEligible({
        propertyType: "studio_room",
        services: [{ serviceKey: "asbestos" }],
      }),
    ).toBe(false);
  });

  it("no asbestos in services → NOT eligible, regardless of property type", () => {
    expect(
      isAssignmentCommissionEligible({
        propertyType: "apartment",
        services: [{ serviceKey: "epc" }, { serviceKey: "electrical" }],
      }),
    ).toBe(false);
  });

  it("asbestos bundled with other services → eligible (any qualifier is enough)", () => {
    expect(
      isAssignmentCommissionEligible({
        propertyType: "apartment",
        services: [{ serviceKey: "epc" }, { serviceKey: "asbestos" }],
      }),
    ).toBe(true);
  });

  it("empty services → NOT eligible", () => {
    expect(
      isAssignmentCommissionEligible({
        propertyType: "apartment",
        services: [],
      }),
    ).toBe(false);
  });

  it("null propertyType + asbestos → eligible (no exclusion trigger)", () => {
    expect(
      isAssignmentCommissionEligible({
        propertyType: null,
        services: [{ serviceKey: "asbestos" }],
      }),
    ).toBe(true);
  });
});

describe("computeCommission — null-returning paths", () => {
  it("team with no commissionType → null", () => {
    expect(
      computeCommission({
        totalCents: 100_000,
        team: { commissionType: null, commissionValue: 1500 },
      }),
    ).toBeNull();
  });

  it("team with null commissionValue → null", () => {
    expect(
      computeCommission({
        totalCents: 100_000,
        team: { commissionType: "percentage", commissionValue: null },
      }),
    ).toBeNull();
  });

  it("team with zero commissionValue → null (not paid)", () => {
    expect(
      computeCommission({
        totalCents: 100_000,
        team: { commissionType: "percentage", commissionValue: 0 },
      }),
    ).toBeNull();
  });

  it("negative commissionValue → null (defensive)", () => {
    expect(
      computeCommission({
        totalCents: 100_000,
        team: { commissionType: "percentage", commissionValue: -100 },
      }),
    ).toBeNull();
  });

  it("unknown commissionType → null", () => {
    expect(
      computeCommission({
        totalCents: 100_000,
        team: { commissionType: "hybrid", commissionValue: 1500 },
      }),
    ).toBeNull();
  });
});

describe("computeCommission — percentage math", () => {
  it("15% of 100_000 cents = 15_000", () => {
    const r = computeCommission({
      totalCents: 100_000,
      team: { commissionType: "percentage", commissionValue: 1500 },
    });
    expect(r).toEqual({ amountCents: 15_000, type: "percentage", value: 1500 });
  });

  it("clamps at 100% bps (10_000) even if stored rate is higher", () => {
    const r = computeCommission({
      totalCents: 100_000,
      team: { commissionType: "percentage", commissionValue: 20_000 },
    });
    expect(r?.amountCents).toBe(100_000); // floored at total
  });

  it("floors cents (customer-favorable rounding)", () => {
    // 1% of 9999 = 99.99 → floor to 99
    const r = computeCommission({
      totalCents: 9_999,
      team: { commissionType: "percentage", commissionValue: 100 },
    });
    expect(r?.amountCents).toBe(99);
  });

  it("0 totalCents × 50% = 0 (percentage doesn't conjure money)", () => {
    const r = computeCommission({
      totalCents: 0,
      team: { commissionType: "percentage", commissionValue: 5000 },
    });
    expect(r?.amountCents).toBe(0);
  });
});

describe("computeCommission — fixed math", () => {
  it("fixed 500 cents returns 500 regardless of invoice total", () => {
    const r = computeCommission({
      totalCents: 100_000,
      team: { commissionType: "fixed", commissionValue: 500 },
    });
    expect(r).toEqual({ amountCents: 500, type: "fixed", value: 500 });
  });

  it("fixed amount is paid EVEN when invoice total is 0 (Platform parity)", () => {
    // Platform: fixed commission is contractual regardless of invoice value.
    const r = computeCommission({
      totalCents: 0,
      team: { commissionType: "fixed", commissionValue: 750 },
    });
    expect(r?.amountCents).toBe(750);
  });

  it("fixed commission is NOT capped at total when total < fixed (Platform parity)", () => {
    // Platform: `computeCommissionAmount(30.00, 'fixed', 50.00) === 50.00`.
    // Parity spec: totalCents=3_000 + fixed=5_000 still pays out 5_000 in full —
    // the previous "total=0" case alone doesn't prove this because 0 is a
    // special edge; here the total is positive-but-below-fixed.
    const r = computeCommission({
      totalCents: 3_000,
      team: { commissionType: "fixed", commissionValue: 5_000 },
    });
    expect(r?.amountCents).toBe(5_000);
  });
});

describe("computeCommission — parity spot-checks", () => {
  // Platform CommissionServiceTest::test_compute_commission_amount_percentage:
  //   computeCommissionAmount(200.00, 'percentage', 15.00) === 30.00
  // In our cents/bps idiom that's 20_000 cents × 1500 bps = 3_000 cents.
  // Existing tests use 100_000 cents which can hide off-by-100-cents scaling
  // bugs — the clean 20_000 × 15 % case locks down Platform's canonical numbers.
  it("percentage clean-integer case: 15% of €200 = €30", () => {
    const r = computeCommission({
      totalCents: 20_000,
      team: { commissionType: "percentage", commissionValue: 1500 },
    });
    expect(r?.amountCents).toBe(3_000);
  });

  it("handles very large totals without overflow (10 M €)", () => {
    // 15% of €10_000_000 = €1_500_000. JS Number is safe up to 2^53,
    // so 1_000_000_000 × 1500 = 1.5e12 is comfortably below — but the
    // assertion is cheap insurance against someone swapping to a different
    // numeric type.
    const r = computeCommission({
      totalCents: 1_000_000_000,
      team: { commissionType: "percentage", commissionValue: 1500 },
    });
    expect(r?.amountCents).toBe(150_000_000);
  });

  it("fixed commission combined with percentage team → only configured type applies", () => {
    // Platform's team row stores ONE (type, value) pair — there's no hybrid.
    // Guard against a refactor that accidentally applies both by asserting
    // a team with type="fixed" completely ignores any percentage surcharge
    // intuition. Using a weird totalCents proves the return is unrelated.
    const r = computeCommission({
      totalCents: 99_999_999,
      team: { commissionType: "fixed", commissionValue: 4_200 },
    });
    expect(r).toEqual({ amountCents: 4_200, type: "fixed", value: 4_200 });
  });
});
