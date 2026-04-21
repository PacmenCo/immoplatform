import "server-only";
import { prisma } from "./db";
import {
  computePricing,
  discountFromAssignment,
  isDiscountType,
  type PricingBreakdown,
} from "./pricing";
import { chartMonths, periodRange, type Period } from "./period";

/**
 * Financial overview — powers `/dashboard/overview`.
 *
 * Revenue is booked at completion (matches commission) — an assignment counts
 * toward a period iff `completedAt` falls in that period. Pricing is derived
 * from each assignment's snapshot services + discount (same math as the
 * invoice), so a retroactive price-list edit doesn't rewrite history.
 */

export type TeamRevenueRow = {
  teamId: string;
  teamName: string;
  teamCity: string | null;
  assignmentCount: number;
  revenueCents: number;          // services revenue + adjustments
  adjustmentCents: number;       // signed, subtotal of adjustments in period
  commissionAccruedCents: number;
  commissionPaidCents: number;
};

export type AdjustmentRow = {
  id: string;
  teamId: string;
  teamName: string;
  year: number;
  month: number;
  description: string;
  amountCents: number;
  createdAt: Date;
  createdByName: string | null;
};

export type MonthBucket = {
  year: number;
  month: number;
  label: string;
  revenueCents: number;
};

export type ServiceBucket = {
  serviceKey: string;
  revenueCents: number;
};

export type FinancialSnapshot = {
  period: Period;
  range: { gte: Date; lt: Date };
  totals: {
    revenueCents: number;
    servicesRevenueCents: number;
    adjustmentCents: number;
    assignmentCount: number;
    commissionAccruedCents: number;
    commissionPaidCents: number;
  };
  byTeam: TeamRevenueRow[];
  byService: ServiceBucket[];
  byMonth: MonthBucket[];
  adjustments: AdjustmentRow[];
  /** Full team list — callers that render a team picker can reuse this
   *  instead of issuing a second `team.findMany`. */
  allTeams: Array<{ id: string; name: string }>;
};

type AssignmentForRevenue = {
  id: string;
  teamId: string | null;
  completedAt: Date | null;
  areaM2: number | null;
  discountType: string | null;
  discountValue: number | null;
  services: Array<{ serviceKey: string; unitPriceCents: number }>;
};

function priceAssignment(a: AssignmentForRevenue): PricingBreakdown {
  return computePricing({
    lines: a.services.map((s) => ({
      serviceKey: s.serviceKey,
      unitPriceCents: s.unitPriceCents,
      quantity: 1,
    })),
    areaM2: a.areaM2,
    discount: isDiscountType(a.discountType)
      ? discountFromAssignment({ discountType: a.discountType, discountValue: a.discountValue })
      : null,
  });
}

/**
 * Distribute the post-discount total across service lines proportionally —
 * otherwise a discount would inflate per-service bars and they wouldn't sum
 * back to the grand total.
 */
function lineContributions(pricing: PricingBreakdown): Array<{ serviceKey: string; cents: number }> {
  const pre = pricing.subtotalCents + pricing.surchargeCents;
  if (pre <= 0) return [];
  const ratio = pricing.totalCents / pre;
  return pricing.lines.map((l) => ({
    serviceKey: l.serviceKey,
    cents: Math.round(l.lineCents * ratio),
  }));
}

export async function loadFinancialOverview(period: Period): Promise<FinancialSnapshot> {
  const range = periodRange(period);
  const chartAxis = chartMonths(period);
  const chartStart = new Date(Date.UTC(chartAxis[0].year, chartAxis[0].month - 1, 1));
  const lastAxis = chartAxis[chartAxis.length - 1];
  const chartEnd = new Date(Date.UTC(lastAxis.year, lastAxis.month, 1));

  const axisYearMonths = chartAxis.map((a) => ({ year: a.year, month: a.month }));
  const axisYears = Array.from(new Set(axisYearMonths.map((a) => a.year)));

  const [assignments, commissionLines, payouts, teams, chartAdjustments] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        status: "completed",
        completedAt: { gte: chartStart, lt: chartEnd },
      },
      select: {
        id: true,
        teamId: true,
        completedAt: true,
        areaM2: true,
        discountType: true,
        discountValue: true,
        services: { select: { serviceKey: true, unitPriceCents: true } },
      },
    }),
    prisma.assignmentCommission.groupBy({
      by: ["teamId"],
      where: { computedAt: { gte: range.gte, lt: range.lt } },
      _sum: { commissionAmountCents: true },
    }),
    prisma.commissionPayout.groupBy({
      by: ["teamId"],
      where: { paidAt: { gte: range.gte, lt: range.lt } },
      _sum: { amountCents: true },
    }),
    prisma.team.findMany({
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    }),
    prisma.revenueAdjustment.findMany({
      where: { year: { in: axisYears } },
      orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
      include: {
        team: { select: { name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const accruedByTeam = new Map(
    commissionLines.map((c) => [c.teamId, c._sum.commissionAmountCents ?? 0]),
  );
  const paidByTeam = new Map(payouts.map((p) => [p.teamId, p._sum.amountCents ?? 0]));

  // Price each assignment once; reuse the breakdown for month buckets,
  // team rollups, and the by-service distribution.
  const pricingById = new Map<string, PricingBreakdown>();
  for (const a of assignments) pricingById.set(a.id, priceAssignment(a));

  const monthKey = (y: number, m: number) => `${y}-${m}`;
  const monthSum = new Map<string, number>();
  for (const a of assignments) {
    if (!a.completedAt) continue;
    const k = monthKey(a.completedAt.getUTCFullYear(), a.completedAt.getUTCMonth() + 1);
    monthSum.set(k, (monthSum.get(k) ?? 0) + (pricingById.get(a.id)?.totalCents ?? 0));
  }
  const axisMonthSet = new Set(axisYearMonths.map((a) => monthKey(a.year, a.month)));
  for (const adj of chartAdjustments) {
    const k = monthKey(adj.year, adj.month);
    if (!axisMonthSet.has(k)) continue;
    monthSum.set(k, (monthSum.get(k) ?? 0) + adj.amountCents);
  }
  const byMonth: MonthBucket[] = chartAxis.map((ax) => ({
    year: ax.year,
    month: ax.month,
    label: ax.label,
    revenueCents: monthSum.get(monthKey(ax.year, ax.month)) ?? 0,
  }));

  const inFocus = assignments.filter(
    (a) => a.completedAt && a.completedAt >= range.gte && a.completedAt < range.lt,
  );

  const teamAgg = new Map<string, { revenueCents: number; assignmentCount: number }>();
  const serviceAgg = new Map<string, number>();
  let focusRevenue = 0;
  for (const a of inFocus) {
    const pricing = pricingById.get(a.id);
    if (!pricing) continue;
    focusRevenue += pricing.totalCents;
    if (a.teamId) {
      const slot = teamAgg.get(a.teamId) ?? { revenueCents: 0, assignmentCount: 0 };
      slot.revenueCents += pricing.totalCents;
      slot.assignmentCount += 1;
      teamAgg.set(a.teamId, slot);
    }
    for (const line of lineContributions(pricing)) {
      serviceAgg.set(line.serviceKey, (serviceAgg.get(line.serviceKey) ?? 0) + line.cents);
    }
  }

  const focusMonths = new Set<string>();
  if (period.kind === "month") focusMonths.add(monthKey(period.year, period.month));
  else if (period.kind === "quarter") {
    const start = (period.quarter - 1) * 3;
    for (let i = 0; i < 3; i++) focusMonths.add(monthKey(period.year, start + i + 1));
  } else {
    for (let m = 1; m <= 12; m++) focusMonths.add(monthKey(period.year, m));
  }
  const focusAdjustments = chartAdjustments.filter((adj) =>
    focusMonths.has(monthKey(adj.year, adj.month)),
  );

  const adjustmentByTeam = new Map<string, number>();
  let adjustmentTotal = 0;
  for (const adj of focusAdjustments) {
    adjustmentByTeam.set(adj.teamId, (adjustmentByTeam.get(adj.teamId) ?? 0) + adj.amountCents);
    adjustmentTotal += adj.amountCents;
  }

  const teamIds = new Set<string>([
    ...teamAgg.keys(),
    ...accruedByTeam.keys(),
    ...paidByTeam.keys(),
    ...adjustmentByTeam.keys(),
  ]);
  const byTeam: TeamRevenueRow[] = [];
  for (const teamId of teamIds) {
    const team = teamById.get(teamId);
    if (!team) continue;
    const agg = teamAgg.get(teamId) ?? { revenueCents: 0, assignmentCount: 0 };
    const adjustmentCents = adjustmentByTeam.get(teamId) ?? 0;
    byTeam.push({
      teamId,
      teamName: team.name,
      teamCity: team.city,
      assignmentCount: agg.assignmentCount,
      revenueCents: agg.revenueCents + adjustmentCents,
      adjustmentCents,
      commissionAccruedCents: accruedByTeam.get(teamId) ?? 0,
      commissionPaidCents: paidByTeam.get(teamId) ?? 0,
    });
  }
  byTeam.sort((a, b) => b.revenueCents - a.revenueCents || a.teamName.localeCompare(b.teamName));

  const byService: ServiceBucket[] = Array.from(serviceAgg.entries())
    .map(([serviceKey, revenueCents]) => ({ serviceKey, revenueCents }))
    .sort((a, b) => b.revenueCents - a.revenueCents);

  const adjustments: AdjustmentRow[] = focusAdjustments.map((adj) => ({
    id: adj.id,
    teamId: adj.teamId,
    teamName: adj.team.name,
    year: adj.year,
    month: adj.month,
    description: adj.description,
    amountCents: adj.amountCents,
    createdAt: adj.createdAt,
    createdByName: adj.createdBy
      ? `${adj.createdBy.firstName} ${adj.createdBy.lastName}`
      : null,
  }));

  return {
    period,
    range,
    totals: {
      revenueCents: focusRevenue + adjustmentTotal,
      servicesRevenueCents: focusRevenue,
      adjustmentCents: adjustmentTotal,
      assignmentCount: inFocus.length,
      commissionAccruedCents: Array.from(accruedByTeam.values()).reduce((s, v) => s + v, 0),
      commissionPaidCents: Array.from(paidByTeam.values()).reduce((s, v) => s + v, 0),
    },
    byTeam,
    byService,
    byMonth,
    adjustments,
    allTeams: teams.map((t) => ({ id: t.id, name: t.name })),
  };
}
