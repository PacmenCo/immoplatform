import { describe, it, expect } from "vitest";
import {
  quarterOf,
  quarterRange,
  dayRange,
  weekRange,
  monthRange,
  endOfMonthMinusDays,
  isSameUtcDay,
  periodRange,
  periodLabel,
  currentPeriod,
  parsePeriod,
  chartMonths,
} from "@/lib/period";

// Parity contracts (UTC-based throughout, no timezone drift):
// - Quarter ranges follow calendar quarters (Q1 = Jan-Mar)
// - `parsePeriod` defaults to the CURRENT QUARTER (matches Platform's
//   OverviewList `$periodType = 'kwartaal'` default)
// - Week = ISO (Monday-start)

describe("quarterOf", () => {
  it("computes the right quarter for each month", () => {
    for (const [m, q] of [
      [0, 1], [1, 1], [2, 1],
      [3, 2], [4, 2], [5, 2],
      [6, 3], [7, 3], [8, 3],
      [9, 4], [10, 4], [11, 4],
    ] as const) {
      const d = new Date(Date.UTC(2026, m, 15));
      expect(quarterOf(d)).toEqual({ year: 2026, quarter: q });
    }
  });
});

describe("quarterRange", () => {
  it("Q1 2026 spans Jan 1 → Apr 1 (inclusive/exclusive)", () => {
    const r = quarterRange(2026, 1);
    expect(r.gte.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(r.lt.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("Q4 2026 spans Oct 1 → Jan 1 of next year", () => {
    const r = quarterRange(2026, 4);
    expect(r.gte.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(r.lt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("dayRange / monthRange (UTC boundaries)", () => {
  it("dayRange snaps to UTC midnight of `now`", () => {
    const r = dayRange(new Date("2026-04-23T14:17:52.000Z"));
    expect(r.gte.toISOString()).toBe("2026-04-23T00:00:00.000Z");
    expect(r.lt.toISOString()).toBe("2026-04-24T00:00:00.000Z");
  });

  it("monthRange covers the full UTC month", () => {
    const r = monthRange(new Date("2026-04-23T14:00:00.000Z"));
    expect(r.gte.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(r.lt.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("monthRange spans 31-day month", () => {
    const r = monthRange(new Date("2026-03-15T00:00:00.000Z"));
    expect(r.gte.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(r.lt.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("weekRange (ISO Monday-start)", () => {
  it("Wednesday Apr 22 2026 snaps to Monday Apr 20", () => {
    const r = weekRange(new Date("2026-04-22T10:00:00.000Z"));
    expect(r.gte.toISOString()).toBe("2026-04-20T00:00:00.000Z");
    expect(r.lt.toISOString()).toBe("2026-04-27T00:00:00.000Z");
  });

  it("Sunday Apr 19 2026 snaps to Monday Apr 13 (previous week)", () => {
    const r = weekRange(new Date("2026-04-19T10:00:00.000Z"));
    expect(r.gte.toISOString()).toBe("2026-04-13T00:00:00.000Z");
  });
});

describe("endOfMonthMinusDays", () => {
  it("3 days before end-of-April 2026 = Apr 27 00:00 UTC", () => {
    const d = endOfMonthMinusDays(new Date("2026-04-15T00:00:00.000Z"), 3);
    expect(d.toISOString()).toBe("2026-04-27T00:00:00.000Z");
  });

  it("0 days before end-of-February in a non-leap year = Feb 28", () => {
    const d = endOfMonthMinusDays(new Date("2026-02-10T00:00:00.000Z"), 0);
    expect(d.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});

describe("isSameUtcDay", () => {
  it("true for two times on the same UTC day", () => {
    expect(
      isSameUtcDay(
        new Date("2026-04-23T00:01:00Z"),
        new Date("2026-04-23T23:59:00Z"),
      ),
    ).toBe(true);
  });

  it("false across midnight UTC", () => {
    expect(
      isSameUtcDay(
        new Date("2026-04-23T23:59:00Z"),
        new Date("2026-04-24T00:01:00Z"),
      ),
    ).toBe(false);
  });
});

describe("periodRange / periodLabel", () => {
  it("year period spans Jan 1 → next Jan 1", () => {
    expect(periodRange({ kind: "year", year: 2026 })).toEqual({
      gte: new Date("2026-01-01T00:00:00Z"),
      lt: new Date("2027-01-01T00:00:00Z"),
    });
  });

  it("quarter period matches quarterRange", () => {
    expect(periodRange({ kind: "quarter", year: 2026, quarter: 2 })).toEqual(
      quarterRange(2026, 2),
    );
  });

  it("month period covers exactly that month", () => {
    expect(periodRange({ kind: "month", year: 2026, month: 4 })).toEqual({
      gte: new Date("2026-04-01T00:00:00Z"),
      lt: new Date("2026-05-01T00:00:00Z"),
    });
  });

  it("labels are human-readable", () => {
    expect(periodLabel({ kind: "year", year: 2026 })).toBe("2026");
    expect(periodLabel({ kind: "quarter", year: 2026, quarter: 3 })).toBe("Q3 2026");
    expect(periodLabel({ kind: "month", year: 2026, month: 4 })).toBe("Apr 2026");
  });
});

describe("currentPeriod", () => {
  const mid = new Date("2026-05-15T12:00:00Z"); // Q2, May
  it("year", () => {
    expect(currentPeriod("year", mid)).toEqual({ kind: "year", year: 2026 });
  });
  it("quarter", () => {
    expect(currentPeriod("quarter", mid)).toEqual({
      kind: "quarter",
      year: 2026,
      quarter: 2,
    });
  });
  it("month", () => {
    expect(currentPeriod("month", mid)).toEqual({
      kind: "month",
      year: 2026,
      month: 5,
    });
  });
});

describe("parsePeriod", () => {
  // Platform parity: OverviewList defaults to 'kwartaal' (quarter).
  it("defaults to quarter when `period` is missing or malformed", () => {
    expect(parsePeriod({}).kind).toBe("quarter");
    expect(parsePeriod({ period: "weekly" }).kind).toBe("quarter");
    expect(parsePeriod({ period: "" }).kind).toBe("quarter");
  });

  it("respects explicit period=year", () => {
    const p = parsePeriod({ period: "year", year: "2025" });
    expect(p).toEqual({ kind: "year", year: 2025 });
  });

  it("respects explicit period=month with numeric month", () => {
    const p = parsePeriod({ period: "month", year: "2026", month: "7" });
    expect(p).toEqual({ kind: "month", year: 2026, month: 7 });
  });

  it("quarter: accepts 1-4 only, clamps to current on bad values", () => {
    const p = parsePeriod({ period: "quarter", year: "2026", quarter: "5" });
    expect(p.kind).toBe("quarter");
    if (p.kind === "quarter") {
      expect([1, 2, 3, 4]).toContain(p.quarter);
    }
  });

  it("month: clamps out-of-range values to current", () => {
    const p = parsePeriod({ period: "month", year: "2026", month: "13" });
    expect(p.kind).toBe("month");
    if (p.kind === "month") {
      expect(p.month).toBeGreaterThanOrEqual(1);
      expect(p.month).toBeLessThanOrEqual(12);
    }
  });

  it("year: out-of-range (pre-2000, post-2100) falls back to current", () => {
    const now = new Date().getUTCFullYear();
    expect(parsePeriod({ period: "year", year: "1999" }).year).toBe(now);
    expect(parsePeriod({ period: "year", year: "2200" }).year).toBe(now);
  });
});

describe("chartMonths", () => {
  it("year view: all 12 months of the target year", () => {
    const cols = chartMonths({ kind: "year", year: 2026 });
    expect(cols).toHaveLength(12);
    expect(cols[0]).toEqual({ year: 2026, month: 1, label: "Jan" });
    expect(cols[11]).toEqual({ year: 2026, month: 12, label: "Dec" });
  });

  it("quarter view: 3 months of the target quarter", () => {
    const cols = chartMonths({ kind: "quarter", year: 2026, quarter: 2 });
    expect(cols).toHaveLength(3);
    expect(cols.map((c) => c.month)).toEqual([4, 5, 6]);
  });

  it("month view: selected month + 3 prior, oldest first", () => {
    const cols = chartMonths({ kind: "month", year: 2026, month: 4 });
    expect(cols).toHaveLength(4);
    expect(cols.map((c) => c.month)).toEqual([1, 2, 3, 4]);
  });

  it("month view rolls across year boundary", () => {
    const cols = chartMonths({ kind: "month", year: 2026, month: 2 });
    expect(cols.map((c) => ({ y: c.year, m: c.month }))).toEqual([
      { y: 2025, m: 11 },
      { y: 2025, m: 12 },
      { y: 2026, m: 1 },
      { y: 2026, m: 2 },
    ]);
  });
});
