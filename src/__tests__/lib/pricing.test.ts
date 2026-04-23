import { describe, it, expect } from "vitest";
import {
  computePricing,
  isDiscountType,
  discountFromAssignment,
  SURCHARGE_THRESHOLD_M2,
  SURCHARGE_PER_BLOCK_BPS,
  MAX_DISCOUNT_PERCENTAGE_BPS,
  MAX_DISCOUNT_FIXED_CENTS,
  type PricingInput,
} from "@/lib/pricing";

// Platform parity: AssignmentPricingService::calculateBaseTotal + surcharge.
// Formula (in order): subtotal → surcharge (20%/100m² above 300) → discount → total.
// All math is integer cents / bps. Totals clamp at 0.

function pricing(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    lines: [],
    areaM2: null,
    discount: null,
    ...overrides,
  };
}

describe("isDiscountType", () => {
  it("accepts 'percentage' and 'fixed'", () => {
    expect(isDiscountType("percentage")).toBe(true);
    expect(isDiscountType("fixed")).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isDiscountType("absolute")).toBe(false);
    expect(isDiscountType(null)).toBe(false);
    expect(isDiscountType(undefined)).toBe(false);
    expect(isDiscountType(1500)).toBe(false);
  });
});

describe("surcharge constants", () => {
  it("300m² threshold, 20% per 100m² block", () => {
    expect(SURCHARGE_THRESHOLD_M2).toBe(300);
    expect(SURCHARGE_PER_BLOCK_BPS).toBe(2000);
  });

  it("discount caps: 100% bps, €100k fixed", () => {
    expect(MAX_DISCOUNT_PERCENTAGE_BPS).toBe(10_000);
    expect(MAX_DISCOUNT_FIXED_CENTS).toBe(10_000_00 * 100);
  });
});

describe("computePricing — subtotal", () => {
  it("empty lines → 0 subtotal, 0 total", () => {
    const r = computePricing(pricing({ lines: [] }));
    expect(r.subtotalCents).toBe(0);
    expect(r.totalCents).toBe(0);
  });

  it("sums unitPrice × quantity per line", () => {
    const r = computePricing(
      pricing({
        lines: [
          { serviceKey: "epc", unitPriceCents: 15_000, quantity: 1 },
          { serviceKey: "asbestos", unitPriceCents: 25_000, quantity: 2 },
        ],
      }),
    );
    expect(r.lines[0].lineCents).toBe(15_000);
    expect(r.lines[1].lineCents).toBe(50_000);
    expect(r.subtotalCents).toBe(65_000);
  });

  it("treats quantity < 1 as 1 (defensive floor)", () => {
    const r = computePricing(
      pricing({
        lines: [{ serviceKey: "epc", unitPriceCents: 10_000, quantity: 0 }],
      }),
    );
    expect(r.lines[0].lineCents).toBe(10_000);
  });

  it("negative unitPrice floors to 0 per line", () => {
    const r = computePricing(
      pricing({
        lines: [{ serviceKey: "epc", unitPriceCents: -500, quantity: 1 }],
      }),
    );
    expect(r.lines[0].lineCents).toBe(0);
    expect(r.subtotalCents).toBe(0);
  });
});

describe("computePricing — surcharge", () => {
  const base = {
    lines: [{ serviceKey: "asbestos", unitPriceCents: 100_000, quantity: 1 }],
  };

  it("areaM2 null → no surcharge", () => {
    const r = computePricing(pricing({ ...base, areaM2: null }));
    expect(r.surchargeBps).toBe(0);
    expect(r.surchargeCents).toBe(0);
  });

  it("areaM2 at threshold (exactly 300) → no surcharge", () => {
    const r = computePricing(pricing({ ...base, areaM2: 300 }));
    expect(r.surchargeBps).toBe(0);
  });

  it("areaM2 301 → 1 block (20%)", () => {
    const r = computePricing(pricing({ ...base, areaM2: 301 }));
    expect(r.surchargeBps).toBe(2000);
    expect(r.surchargeCents).toBe(20_000); // 20% of 100_000
  });

  it("areaM2 400 → 1 block (20%)", () => {
    const r = computePricing(pricing({ ...base, areaM2: 400 }));
    expect(r.surchargeBps).toBe(2000);
  });

  it("areaM2 401 → 2 blocks (40%)", () => {
    const r = computePricing(pricing({ ...base, areaM2: 401 }));
    expect(r.surchargeBps).toBe(4000);
    expect(r.surchargeCents).toBe(40_000);
  });

  it("areaM2 500 → 2 blocks (40%) — ceiling at block boundary", () => {
    const r = computePricing(pricing({ ...base, areaM2: 500 }));
    expect(r.surchargeBps).toBe(4000);
  });

  it("areaM2 1000 → 7 blocks (140%)", () => {
    const r = computePricing(pricing({ ...base, areaM2: 1000 }));
    expect(r.surchargeBps).toBe(14_000);
    expect(r.surchargeCents).toBe(140_000);
  });

  it("surcharge floors cents (customer-favorable rounding)", () => {
    // 301 m² + €100.01 subtotal → 20% → €20.002 → floor to 2000 cents
    const r = computePricing(
      pricing({
        lines: [{ serviceKey: "epc", unitPriceCents: 10_001, quantity: 1 }],
        areaM2: 301,
      }),
    );
    expect(r.surchargeCents).toBe(2000); // floor(20002/10000 * 10001) = 2000
  });
});

describe("computePricing — discount", () => {
  const base = {
    lines: [{ serviceKey: "asbestos", unitPriceCents: 100_000, quantity: 1 }],
  };

  it("no discount → preDiscount == total", () => {
    const r = computePricing(pricing({ ...base, discount: null }));
    expect(r.discountCents).toBe(0);
    expect(r.totalCents).toBe(100_000);
  });

  it("percentage: 15% of 100_000 = 15_000", () => {
    const r = computePricing(
      pricing({ ...base, discount: { type: "percentage", bps: 1500 } }),
    );
    expect(r.discountCents).toBe(15_000);
    expect(r.totalCents).toBe(85_000);
  });

  it("percentage: 100% (10_000 bps) clamps at preDiscount — total is 0", () => {
    const r = computePricing(
      pricing({ ...base, discount: { type: "percentage", bps: 10_000 } }),
    );
    expect(r.discountCents).toBe(100_000);
    expect(r.totalCents).toBe(0);
  });

  it("percentage: >100% is clamped to preDiscount (total floors at 0)", () => {
    const r = computePricing(
      pricing({ ...base, discount: { type: "percentage", bps: 20_000 } }),
    );
    expect(r.discountCents).toBe(100_000);
    expect(r.totalCents).toBe(0);
  });

  it("fixed: 25_000 cents off 100_000 → 75_000", () => {
    const r = computePricing(
      pricing({ ...base, discount: { type: "fixed", cents: 25_000 } }),
    );
    expect(r.discountCents).toBe(25_000);
    expect(r.totalCents).toBe(75_000);
  });

  it("fixed: discount > preDiscount clamps, total floors at 0", () => {
    const r = computePricing(
      pricing({ ...base, discount: { type: "fixed", cents: 500_000 } }),
    );
    expect(r.discountCents).toBe(100_000);
    expect(r.totalCents).toBe(0);
  });

  it("fixed: negative-cents-input floors at 0 (no bonus to customer)", () => {
    const r = computePricing(
      pricing({ ...base, discount: { type: "fixed", cents: -1000 } }),
    );
    expect(r.discountCents).toBe(0);
    expect(r.totalCents).toBe(100_000);
  });

  it("discount applies to subtotal + surcharge, not subtotal alone", () => {
    // areaM2 400 → 20% surcharge on 100_000 = 120_000 preDiscount
    // 50% off = 60_000 discount, total = 60_000
    const r = computePricing(
      pricing({
        ...base,
        areaM2: 400,
        discount: { type: "percentage", bps: 5000 },
      }),
    );
    expect(r.surchargeCents).toBe(20_000);
    expect(r.discountCents).toBe(60_000);
    expect(r.totalCents).toBe(60_000);
  });
});

describe("discountFromAssignment", () => {
  it("null discountType → null", () => {
    expect(
      discountFromAssignment({ discountType: null, discountValue: 1500 }),
    ).toBeNull();
  });

  it("null discountValue → null", () => {
    expect(
      discountFromAssignment({ discountType: "percentage", discountValue: null }),
    ).toBeNull();
  });

  it("zero discountValue → null (no discount)", () => {
    expect(
      discountFromAssignment({ discountType: "percentage", discountValue: 0 }),
    ).toBeNull();
  });

  it("negative discountValue → null (defensive)", () => {
    expect(
      discountFromAssignment({ discountType: "percentage", discountValue: -100 }),
    ).toBeNull();
  });

  it("unknown discountType → null", () => {
    expect(
      discountFromAssignment({ discountType: "bogus", discountValue: 1500 }),
    ).toBeNull();
  });

  it("percentage: returns bps as-is", () => {
    expect(
      discountFromAssignment({ discountType: "percentage", discountValue: 1500 }),
    ).toEqual({ type: "percentage", bps: 1500 });
  });

  it("fixed: returns cents as-is", () => {
    expect(
      discountFromAssignment({ discountType: "fixed", discountValue: 2500 }),
    ).toEqual({ type: "fixed", cents: 2500 });
  });
});
