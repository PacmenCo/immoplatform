/**
 * Pure calendar + period helpers. No server-only dependencies — safe to
 * import from both client and server components.
 */

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const QUARTERS = [1, 2, 3, 4] as const;

export type PeriodKind = "month" | "quarter" | "year";

export type Period =
  | { kind: "month"; year: number; month: number }
  | { kind: "quarter"; year: number; quarter: number }
  | { kind: "year"; year: number };

// ─── Quarter primitives (UTC) ──────────────────────────────────────

export function quarterOf(date: Date): { year: number; quarter: number } {
  return {
    year: date.getUTCFullYear(),
    quarter: Math.floor(date.getUTCMonth() / 3) + 1,
  };
}

/** [gte, lt) UTC range for a calendar quarter. */
export function quarterRange(year: number, quarter: number): { gte: Date; lt: Date } {
  const startMonth = (quarter - 1) * 3;
  return {
    gte: new Date(Date.UTC(year, startMonth, 1)),
    lt: new Date(Date.UTC(year, startMonth + 3, 1)),
  };
}

// ─── Short-range helpers for dashboards (UTC boundaries) ───────────
// Used for "today's jobs", "this week", "this month" counts. UTC-boundary
// approximation of local day — close enough for dashboard stats and
// consistent with the rest of immo's UTC storage. See also: Platform's
// Carbon-based Local-timezone boundaries (`now()->startOfDay()` etc.) —
// these will differ by up to 2 hours (Brussels offset) near midnight.

export function dayRange(now: Date = new Date()): { gte: Date; lt: Date } {
  const gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const lt = new Date(gte);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

export function weekRange(now: Date = new Date()): { gte: Date; lt: Date } {
  // ISO week — Monday through Sunday. getUTCDay() returns 0-6 with Sunday=0,
  // so (day + 6) % 7 shifts Monday=0.
  const weekday = (now.getUTCDay() + 6) % 7;
  const gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  gte.setUTCDate(gte.getUTCDate() - weekday);
  const lt = new Date(gte);
  lt.setUTCDate(lt.getUTCDate() + 7);
  return { gte, lt };
}

export function monthRange(now: Date = new Date()): { gte: Date; lt: Date } {
  return {
    gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    lt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

/** Midnight-UTC of (last day of month − days). Used by the invoice-reminder
 *  cron to compute its target fire date. */
export function endOfMonthMinusDays(now: Date, days: number): Date {
  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  endOfMonth.setUTCDate(endOfMonth.getUTCDate() - days);
  endOfMonth.setUTCHours(0, 0, 0, 0);
  return endOfMonth;
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

// ─── Period helpers ────────────────────────────────────────────────

export function periodRange(p: Period): { gte: Date; lt: Date } {
  if (p.kind === "year") {
    return {
      gte: new Date(Date.UTC(p.year, 0, 1)),
      lt: new Date(Date.UTC(p.year + 1, 0, 1)),
    };
  }
  if (p.kind === "quarter") return quarterRange(p.year, p.quarter);
  return {
    gte: new Date(Date.UTC(p.year, p.month - 1, 1)),
    lt: new Date(Date.UTC(p.year, p.month, 1)),
  };
}

export function periodLabel(p: Period): string {
  if (p.kind === "year") return `${p.year}`;
  if (p.kind === "quarter") return `Q${p.quarter} ${p.year}`;
  return `${MONTH_SHORT[p.month - 1]} ${p.year}`;
}

/** Current-time period of the requested kind (UTC). */
export function currentPeriod(kind: PeriodKind, now: Date = new Date()): Period {
  const year = now.getUTCFullYear();
  if (kind === "year") return { kind, year };
  if (kind === "quarter") return { kind, year, quarter: quarterOf(now).quarter };
  return { kind, year, month: now.getUTCMonth() + 1 };
}

/**
 * Normalize a URL search-params shape into a Period. Falls back to the
 * current quarter if any field is missing or malformed — mirrors Platform's
 * OverviewList default (`$periodType = 'kwartaal'`).
 */
export function parsePeriod(sp: {
  period?: string;
  year?: string;
  month?: string;
  quarter?: string;
}): Period {
  const kind: PeriodKind =
    sp.period === "year" || sp.period === "month" ? sp.period : "quarter";
  const now = new Date();
  const year = Number.parseInt(sp.year ?? "", 10);
  const y = Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : now.getUTCFullYear();
  if (kind === "year") return { kind: "year", year: y };
  if (kind === "month") {
    const m = Number.parseInt(sp.month ?? "", 10);
    const month = m >= 1 && m <= 12 ? m : now.getUTCMonth() + 1;
    return { kind: "month", year: y, month };
  }
  const q = Number.parseInt(sp.quarter ?? "", 10);
  const quarter = QUARTERS.includes(q as 1 | 2 | 3 | 4)
    ? (q as 1 | 2 | 3 | 4)
    : quarterOf(now).quarter;
  return { kind: "quarter", year: y, quarter };
}

/** Chart axis: the months that should appear under the bar chart. */
export function chartMonths(p: Period): Array<{ year: number; month: number; label: string }> {
  if (p.kind === "year") {
    return Array.from({ length: 12 }, (_, i) => ({
      year: p.year,
      month: i + 1,
      label: MONTH_SHORT[i],
    }));
  }
  if (p.kind === "quarter") {
    const start = (p.quarter - 1) * 3;
    return Array.from({ length: 3 }, (_, i) => ({
      year: p.year,
      month: start + i + 1,
      label: MONTH_SHORT[start + i],
    }));
  }
  // Month view: the selected month + 3 prior, oldest first.
  const months: Array<{ year: number; month: number; label: string }> = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(Date.UTC(p.year, p.month - 1 - i, 1));
    months.push({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      label: MONTH_SHORT[d.getUTCMonth()],
    });
  }
  return months;
}
