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
 * current month if any field is missing or malformed.
 */
export function parsePeriod(sp: {
  period?: string;
  year?: string;
  month?: string;
  quarter?: string;
}): Period {
  const kind: PeriodKind =
    sp.period === "year" || sp.period === "quarter" ? sp.period : "month";
  const now = new Date();
  const year = Number.parseInt(sp.year ?? "", 10);
  const y = Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : now.getUTCFullYear();
  if (kind === "year") return { kind: "year", year: y };
  if (kind === "quarter") {
    const q = Number.parseInt(sp.quarter ?? "", 10);
    const quarter = QUARTERS.includes(q as 1 | 2 | 3 | 4)
      ? (q as 1 | 2 | 3 | 4)
      : quarterOf(now).quarter;
    return { kind: "quarter", year: y, quarter };
  }
  const m = Number.parseInt(sp.month ?? "", 10);
  const month = m >= 1 && m <= 12 ? m : now.getUTCMonth() + 1;
  return { kind: "month", year: y, month };
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
