import { prisma } from "./db";

/**
 * Pure pricing calculator matching Platform's AssignmentPricingService.
 *
 * Formula (applied in this order):
 *   subtotal    = Σ(unitPrice × quantity) per service line
 *   surcharge   = subtotal × ceil((areaM² − 300) / 100) × 20%     when areaM² > 300
 *   discount    = applied to (subtotal + surcharge)
 *   total       = max(0, subtotal + surcharge − discount)
 *
 * All math is in integer cents / basis points to avoid IEEE 754 drift.
 * Platform uses PHP floats and rounds at the edges — our integer math
 * produces the same totals for normal inputs and stays exact.
 */

export const SURCHARGE_THRESHOLD_M2 = 300;
export const SURCHARGE_PER_BLOCK_BPS = 2000; // 20 % per 100 m² block

export type PricingLineInput = {
  serviceKey: string;
  unitPriceCents: number;
  quantity: number;
};

export type PricingDiscountInput =
  | { type: "percentage"; bps: number } // 1500 = 15 %
  | { type: "fixed"; cents: number }
  | null;

export type PricingInput = {
  lines: PricingLineInput[];
  areaM2: number | null;
  discount: PricingDiscountInput;
};

export type PricingLine = PricingLineInput & {
  lineCents: number;
};

export type PricingBreakdown = {
  lines: PricingLine[];
  subtotalCents: number;
  surchargeBps: number; // 0 when no surcharge, else per-100m² × 2000
  surchargeCents: number;
  discountCents: number;
  totalCents: number;
};

export function computePricing(input: PricingInput): PricingBreakdown {
  const lines: PricingLine[] = input.lines.map((l) => ({
    ...l,
    lineCents: Math.max(0, Math.floor(l.unitPriceCents * Math.max(1, l.quantity))),
  }));
  const subtotalCents = lines.reduce((s, l) => s + l.lineCents, 0);

  const { surchargeBps, surchargeCents } = surchargeFor(
    subtotalCents,
    input.areaM2,
  );

  const preDiscountCents = subtotalCents + surchargeCents;
  const discountCents = discountFor(preDiscountCents, input.discount);

  return {
    lines,
    subtotalCents,
    surchargeBps,
    surchargeCents,
    discountCents,
    totalCents: Math.max(0, preDiscountCents - discountCents),
  };
}

function surchargeFor(
  subtotalCents: number,
  areaM2: number | null,
): { surchargeBps: number; surchargeCents: number } {
  if (!areaM2 || areaM2 <= SURCHARGE_THRESHOLD_M2) {
    return { surchargeBps: 0, surchargeCents: 0 };
  }
  const excessM2 = areaM2 - SURCHARGE_THRESHOLD_M2;
  const blocks = Math.ceil(excessM2 / 100);
  const surchargeBps = blocks * SURCHARGE_PER_BLOCK_BPS;
  // floor to keep rounding predictable and in the customer's favor
  const surchargeCents = Math.floor((subtotalCents * surchargeBps) / 10_000);
  return { surchargeBps, surchargeCents };
}

function discountFor(
  preDiscountCents: number,
  discount: PricingDiscountInput,
): number {
  if (!discount) return 0;
  if (discount.type === "percentage") {
    return Math.max(
      0,
      Math.min(
        preDiscountCents,
        Math.floor((preDiscountCents * discount.bps) / 10_000),
      ),
    );
  }
  return Math.max(0, Math.min(preDiscountCents, discount.cents));
}

/** Parse discount columns off an Assignment row into the pricing-input shape. */
export function discountFromAssignment(a: {
  discountType: string | null;
  discountValue: number | null;
}): PricingDiscountInput {
  if (!a.discountType || a.discountValue === null || a.discountValue <= 0) {
    return null;
  }
  if (a.discountType === "percentage") return { type: "percentage", bps: a.discountValue };
  if (a.discountType === "fixed") return { type: "fixed", cents: a.discountValue };
  return null;
}

/**
 * Load an assignment's services + discount from the DB and compute its
 * full pricing breakdown. Returns null if the assignment doesn't exist.
 *
 * Uses the `unitPriceCents` snapshot on AssignmentService, so a retroactive
 * price-list change does not alter in-flight invoices.
 */
export async function loadAssignmentPricing(
  assignmentId: string,
): Promise<PricingBreakdown | null> {
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      areaM2: true,
      discountType: true,
      discountValue: true,
      services: { select: { serviceKey: true, unitPriceCents: true } },
    },
  });
  if (!a) return null;

  return computePricing({
    lines: a.services.map((s) => ({
      serviceKey: s.serviceKey,
      unitPriceCents: s.unitPriceCents,
      quantity: 1,
    })),
    areaM2: a.areaM2,
    discount: discountFromAssignment(a),
  });
}

/**
 * Resolve the effective unit price for a (team, service) pair at assignment-
 * creation time. Prefers a TeamServiceOverride, falls back to Service.unitPrice.
 *
 * Used by createAssignment + updateAssignment to take the price snapshot.
 */
export async function effectiveUnitPriceCents(
  teamId: string | null,
  serviceKey: string,
): Promise<number> {
  if (teamId) {
    const override = await prisma.teamServiceOverride.findUnique({
      where: { teamId_serviceKey: { teamId, serviceKey } },
      select: { priceCents: true },
    });
    if (override) return override.priceCents;
  }
  const service = await prisma.service.findUnique({
    where: { key: serviceKey },
    select: { unitPrice: true },
  });
  return service?.unitPrice ?? 0;
}

/** Format cents as "€ 123.45" — UI helper. */
export function formatEuros(cents: number): string {
  const whole = Math.floor(Math.abs(cents) / 100);
  const frac = (Math.abs(cents) % 100).toString().padStart(2, "0");
  const sign = cents < 0 ? "−" : "";
  return `${sign}€ ${whole}.${frac}`;
}
