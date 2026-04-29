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

/** Closed list of discount types the UI + API accept. Keep in sync with
 *  `Assignment.discountType` values written by `parseDiscountFromForm`. */
export const DISCOUNT_TYPES = ["percentage", "fixed"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export function isDiscountType(s: unknown): s is DiscountType {
  return (DISCOUNT_TYPES as readonly string[]).includes(s as string);
}

/** Defensive caps applied at the API edge.  Percentage maxes at 100 %;
 *  fixed discount capped at €100 000 to catch dumb input while allowing
 *  real-world volume deals. */
export const MAX_DISCOUNT_PERCENTAGE_BPS = 10_000;
export const MAX_DISCOUNT_FIXED_CENTS = 10_000_00 * 100; // €100,000.00

export type PricingLineInput = {
  serviceKey: string;
  unitPriceCents: number;
  quantity: number;
};

export type PricingDiscountInput =
  | { type: "percentage"; bps: number } // 1500 = 15 %
  | { type: "fixed"; cents: number }
  | null;

/**
 * Resolve the unit-price snapshot for every service in `serviceKeys`
 * under a given team in TWO queries (not N), so the resulting snapshot
 * is internally consistent even if a concurrent `setTeamServiceOverride`
 * fires between rows. Falls back to `Service.unitPrice` when no override
 * exists for a key. Returns 0 for unknown keys.
 */
export async function resolveUnitPrices(
  teamId: string | null,
  serviceKeys: string[],
): Promise<Map<string, number>> {
  if (serviceKeys.length === 0) return new Map();
  const [overrides, services] = await Promise.all([
    teamId
      ? prisma.teamServiceOverride.findMany({
          where: { teamId, serviceKey: { in: serviceKeys } },
          select: { serviceKey: true, priceCents: true },
        })
      : Promise.resolve([] as Array<{ serviceKey: string; priceCents: number | null }>),
    prisma.service.findMany({
      where: { key: { in: serviceKeys } },
      select: { key: true, unitPrice: true },
    }),
  ]);
  const byKey = new Map<string, number>();
  for (const s of services) byKey.set(s.key, s.unitPrice);
  // Pricelist-only rows have a null `priceCents` — skip them, the team
  // doesn't override the unit price (the bound pricelist drives invoicing).
  for (const o of overrides) if (o.priceCents !== null) byKey.set(o.serviceKey, o.priceCents);
  for (const k of serviceKeys) if (!byKey.has(k)) byKey.set(k, 0);
  return byKey;
}

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
  if (!isDiscountType(a.discountType)) return null;
  if (a.discountType === "percentage") return { type: "percentage", bps: a.discountValue };
  return { type: "fixed", cents: a.discountValue };
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
      quantity: true,
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
      quantity: a.quantity,
    })),
    areaM2: a.areaM2,
    discount: discountFromAssignment(a),
  });
}

/**
 * Single-key convenience wrapper over `resolveUnitPrices`.  Prefer the
 * multi-key version whenever you need prices for more than one service on
 * the same team — it's atomic.
 */
export async function effectiveUnitPriceCents(
  teamId: string | null,
  serviceKey: string,
): Promise<number> {
  const map = await resolveUnitPrices(teamId, [serviceKey]);
  return map.get(serviceKey) ?? 0;
}
