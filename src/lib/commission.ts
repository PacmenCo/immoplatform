import "server-only";
import { prisma } from "./db";
import {
  discountFromAssignment,
  computePricing,
  isDiscountType,
  type PricingBreakdown,
} from "./pricing";

/**
 * Commission engine — ports Platform's CommissionService to TypeScript.
 *
 * - Computes a commission line per assignment at completion time.
 * - Snapshots the team's `commissionType` / `commissionValue` on the line
 *   so later Team edits don't rewrite history.
 * - Eligibility matches Platform: asbestos service + non-excluded property
 *   type + team has commission config.
 * - Quarterly rollup is a runtime aggregate (no scheduled job).
 */

/** Property types that do NOT earn commission, regardless of service mix.
 *  Platform excludes `"Studentenkamer"`; our equivalent option is `studio_room`. */
export const EXCLUDED_PROPERTY_TYPES: ReadonlySet<string> = new Set(["studio_room"]);

/** Assignment must include at least one of these service keys to earn commission. */
export const COMMISSION_ELIGIBLE_SERVICES: ReadonlySet<string> = new Set(["asbestos"]);

export type CommissionInput = {
  totalCents: number;
  team: {
    commissionType: string | null;
    commissionValue: number | null;
  };
};

export type CommissionResult = {
  amountCents: number;
  type: "percentage" | "fixed";
  value: number;
};

/**
 * Pure compute step. Returns `null` when the team has no commission config
 * or the configured type is unrecognized. Amount is always rounded down to
 * whole cents (customer-favorable / integer-math consistent with pricing).
 */
export function computeCommission(input: CommissionInput): CommissionResult | null {
  const type = input.team.commissionType;
  const value = input.team.commissionValue;
  if (!type || value === null || value <= 0) return null;
  if (type === "percentage") {
    const amountCents = Math.max(
      0,
      Math.floor((input.totalCents * value) / 10_000),
    );
    return { amountCents, type: "percentage", value };
  }
  if (type === "fixed") {
    return { amountCents: Math.max(0, value), type: "fixed", value };
  }
  return null;
}

type EligibilityAssignment = {
  propertyType: string | null;
  services: Array<{ serviceKey: string }>;
};

export function isAssignmentCommissionEligible(a: EligibilityAssignment): boolean {
  if (a.propertyType && EXCLUDED_PROPERTY_TYPES.has(a.propertyType)) return false;
  return a.services.some((s) => COMMISSION_ELIGIBLE_SERVICES.has(s.serviceKey));
}

/**
 * Idempotent apply: computes the commission for the given assignment and
 * upserts the row. Safe to call multiple times — the unique constraint on
 * `assignmentId` ensures no duplicates, and `computedAt` gets refreshed.
 *
 * Returns the stored row id or null if the assignment isn't eligible.
 * Swallows "missing team" / "team has no commission config" silently —
 * those aren't errors, they're "nothing to do."
 */
export async function applyCommission(
  assignmentId: string,
): Promise<{ id: string; amountCents: number } | null> {
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      teamId: true,
      propertyType: true,
      discountType: true,
      discountValue: true,
      areaM2: true,
      services: { select: { serviceKey: true, unitPriceCents: true } },
      team: {
        select: {
          id: true,
          commissionType: true,
          commissionValue: true,
        },
      },
    },
  });
  if (!a || !a.teamId || !a.team) return null;
  if (!isAssignmentCommissionEligible(a)) return null;

  const totalCents = totalFromAssignment({
    areaM2: a.areaM2,
    discountType: a.discountType,
    discountValue: a.discountValue,
    services: a.services,
  }).totalCents;

  const result = computeCommission({
    totalCents,
    team: {
      commissionType: a.team.commissionType,
      commissionValue: a.team.commissionValue,
    },
  });
  if (!result) return null;

  const row = await prisma.assignmentCommission.upsert({
    where: { assignmentId },
    create: {
      assignmentId,
      teamId: a.teamId,
      assignmentTotalCents: totalCents,
      commissionType: result.type,
      commissionValue: result.value,
      commissionAmountCents: result.amountCents,
    },
    update: {
      teamId: a.teamId,
      assignmentTotalCents: totalCents,
      commissionType: result.type,
      commissionValue: result.value,
      commissionAmountCents: result.amountCents,
    },
    select: { id: true, commissionAmountCents: true },
  });
  return { id: row.id, amountCents: row.commissionAmountCents };
}

/** Load an assignment's commission line, if any. */
export async function loadAssignmentCommission(assignmentId: string) {
  return prisma.assignmentCommission.findUnique({
    where: { assignmentId },
    select: {
      commissionAmountCents: true,
      commissionType: true,
      commissionValue: true,
      assignmentTotalCents: true,
      computedAt: true,
    },
  });
}

// ─── Quarterly helpers ─────────────────────────────────────────────

export function quarterOf(date: Date): { year: number; quarter: number } {
  return {
    year: date.getFullYear(),
    quarter: Math.floor(date.getMonth() / 3) + 1,
  };
}

/** [gte, lt) range for a calendar quarter. */
export function quarterRange(year: number, quarter: number): { gte: Date; lt: Date } {
  const startMonth = (quarter - 1) * 3;
  const gte = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const lt = new Date(year, startMonth + 3, 1, 0, 0, 0, 0);
  return { gte, lt };
}

export type QuarterTotalRow = {
  teamId: string;
  teamName: string;
  teamCity: string | null;
  totalCents: number;
  lineCount: number;
  payout: {
    amountCents: number;
    paidAt: Date;
    paidByName: string | null;
  } | null;
};

/**
 * Per-team totals for a given quarter. Aggregates AssignmentCommission lines
 * whose `computedAt` falls in the quarter, joins in the CommissionPayout row
 * if one exists, and folds in team name + city for display.
 */
export async function quarterlyTotalsByTeam(
  year: number,
  quarter: number,
): Promise<QuarterTotalRow[]> {
  const { gte, lt } = quarterRange(year, quarter);
  const [grouped, teams, payouts] = await Promise.all([
    prisma.assignmentCommission.groupBy({
      by: ["teamId"],
      where: { computedAt: { gte, lt } },
      _sum: { commissionAmountCents: true },
      _count: { _all: true },
    }),
    prisma.team.findMany({ select: { id: true, name: true, city: true } }),
    prisma.commissionPayout.findMany({
      where: { year, quarter },
      include: {
        paidBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const payoutByTeam = new Map(payouts.map((p) => [p.teamId, p]));

  return grouped
    .map((g) => {
      const team = teamById.get(g.teamId);
      if (!team) return null;
      const payout = payoutByTeam.get(g.teamId);
      return {
        teamId: g.teamId,
        teamName: team.name,
        teamCity: team.city,
        totalCents: g._sum.commissionAmountCents ?? 0,
        lineCount: g._count._all,
        payout: payout
          ? {
              amountCents: payout.amountCents,
              paidAt: payout.paidAt,
              paidByName: payout.paidBy
                ? `${payout.paidBy.firstName} ${payout.paidBy.lastName}`
                : null,
            }
          : null,
      };
    })
    .filter((r): r is QuarterTotalRow => r !== null)
    .sort((a, b) => a.teamName.localeCompare(b.teamName));
}

/** One team's commission lines for a quarter, with per-assignment detail. */
export async function teamQuarterLines(
  teamId: string,
  year: number,
  quarter: number,
) {
  const { gte, lt } = quarterRange(year, quarter);
  return prisma.assignmentCommission.findMany({
    where: { teamId, computedAt: { gte, lt } },
    orderBy: { computedAt: "asc" },
    include: {
      assignment: {
        select: {
          id: true,
          reference: true,
          address: true,
          city: true,
          postal: true,
          propertyType: true,
        },
      },
    },
  });
}

// ─── Internal helpers ──────────────────────────────────────────────

function totalFromAssignment(a: {
  areaM2: number | null;
  discountType: string | null;
  discountValue: number | null;
  services: Array<{ serviceKey: string; unitPriceCents: number }>;
}): PricingBreakdown {
  return computePricing({
    lines: a.services.map((s) => ({
      serviceKey: s.serviceKey,
      unitPriceCents: s.unitPriceCents,
      quantity: 1,
    })),
    areaM2: a.areaM2,
    discount: isDiscountType(a.discountType)
      ? discountFromAssignment({
          discountType: a.discountType,
          discountValue: a.discountValue,
        })
      : null,
  });
}
