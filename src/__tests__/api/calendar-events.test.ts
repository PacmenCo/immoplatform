import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { NextRequest } from "next/server";
import type { SessionWithUser } from "@/lib/auth";
import { prisma, resetDb, disconnectDb } from "../_helpers/db";
import { seedBaseline, seedAssignment } from "../_helpers/fixtures";

// The route reads session via `requireSession()` → `getSession()` → cookie.
// Next's `cookies()` helper only works inside a real request context
// (AsyncLocalStorage store set by the Next dispatcher). Calling the route
// handler directly from Vitest bypasses that, so we mock `@/lib/auth` at the
// module boundary: the route imports `requireSession` from there, and we
// swap in a stub that returns whichever session a test pushed onto
// `currentSession`. `audit` is re-exported from the same module as
// pass-through so assertions relying on audit rows still work — but the
// events route doesn't call audit anyway.
//
// NOTE: `vi.mock` must run before any import of the mocked module's consumers.
// Vitest hoists `vi.mock` above the transpiled `import`s, so top-of-file
// placement is correct.

let currentSession: SessionWithUser | null = null;

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    requireSession: async () => {
      if (!currentSession) throw new Error("UNAUTHENTICATED");
      return currentSession;
    },
    getSession: async () => currentSession,
  };
});

// Import the route AFTER the mock has been declared. Vitest hoists `vi.mock`
// above imports, so a normal top-level import is fine.
import { GET } from "@/app/api/calendar/events/route";

const URL_BASE = "http://localhost/api/calendar/events";

function makeReq(query: string): NextRequest {
  // NextRequest is a Request subclass; the handler only reaches for
  // `.url` and `.headers`, both inherited. Casting is safe for the narrow
  // surface this handler touches.
  return new Request(`${URL_BASE}?${query}`) as unknown as NextRequest;
}

describe("GET /api/calendar/events", () => {
  beforeEach(async () => {
    await resetDb();
    currentSession = null;
  });
  afterAll(async () => {
    await disconnectDb();
    vi.restoreAllMocks();
  });

  it("401 when there is no session cookie", async () => {
    const res = await GET(makeReq("start=2026-04-01&end=2026-04-30"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "UNAUTHENTICATED" });
  });

  it("400 when start or end is missing", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;

    const noEnd = await GET(makeReq("start=2026-04-01"));
    expect(noEnd.status).toBe(400);

    const noStart = await GET(makeReq("end=2026-04-30"));
    expect(noStart.status).toBe(400);

    const neither = await GET(makeReq(""));
    expect(neither.status).toBe(400);
  });

  it("400 when start/end are not YYYY-MM-DD", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;

    const res = await GET(makeReq("start=2026/04/01&end=2026-04-30"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/YYYY-MM-DD/);

    const res2 = await GET(makeReq("start=2026-04-01&end=not-a-date"));
    expect(res2.status).toBe(400);
  });

  it("400 when start > end", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;

    const res = await GET(makeReq("start=2026-04-30&end=2026-04-01"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/start must be <= end/);
  });

  it("400 when range exceeds 90 days", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;

    // Jan 1 → May 1 ≈ 120 days.
    const res = await GET(makeReq("start=2026-01-01&end=2026-05-01"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/exceeds 90 days/);
  });

  it("admin session sees all assignments within range", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;

    const inRange = new Date("2026-04-15T10:00:00.000Z");
    const outOfRange = new Date("2026-06-15T10:00:00.000Z");

    await seedAssignment({
      id: "a_inrange_team",
      teamId: baseline.teams.t1.id,
      preferredDate: inRange,
    });
    await seedAssignment({
      id: "a_inrange_fl",
      freelancerId: baseline.freelancer.user.id,
      preferredDate: inRange,
    });
    await seedAssignment({
      id: "a_out",
      teamId: baseline.teams.t1.id,
      preferredDate: outOfRange,
    });

    const res = await GET(makeReq("start=2026-04-01&end=2026-04-30"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.events.map((e: { id: string }) => e.id).sort();
    expect(ids).toEqual(["a_inrange_fl", "a_inrange_team"]);
  });

  it("freelancer session sees only own assignments (scope filter)", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.freelancer;

    const inRange = new Date("2026-04-15T10:00:00.000Z");

    // Mine — freelancerId matches
    await seedAssignment({
      id: "a_mine",
      freelancerId: baseline.freelancer.user.id,
      preferredDate: inRange,
    });
    // Not mine — different freelancer, no team membership overlap.
    // freelancer in baseline is team-less, so this one is invisible.
    await seedAssignment({
      id: "a_notmine_team",
      teamId: baseline.teams.t2.id, // spare team, freelancer isn't a member
      preferredDate: inRange,
    });
    // Not mine — admin-created, unowned.
    await seedAssignment({
      id: "a_notmine_unowned",
      preferredDate: inRange,
    });

    const res = await GET(makeReq("start=2026-04-01&end=2026-04-30"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.events.map((e: { id: string }) => e.id);
    expect(ids).toEqual(["a_mine"]);
  });

  it("calendarDate in range + preferredDate out of range → returned (ladder: calendarDate wins)", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;

    // preferredDate is in June, calendarDate is in April — the calendar
    // widget should surface this row when the caller asks for April.
    const a = await seedAssignment({
      id: "a_cal_override",
      teamId: baseline.teams.t1.id,
      preferredDate: new Date("2026-06-15T10:00:00.000Z"),
    });
    await prisma.assignment.update({
      where: { id: a.id },
      data: { calendarDate: new Date("2026-04-15T10:00:00.000Z") },
    });

    const res = await GET(makeReq("start=2026-04-01&end=2026-04-30"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.events.map((e: { id: string }) => e.id);
    expect(ids).toContain("a_cal_override");

    // Sanity: the row whose calendarDate is null + preferredDate out of
    // range must NOT be returned. This is the complement of the ladder.
    await seedAssignment({
      id: "a_pref_only_out",
      teamId: baseline.teams.t1.id,
      preferredDate: new Date("2026-06-15T10:00:00.000Z"),
    });
    const res2 = await GET(makeReq("start=2026-04-01&end=2026-04-30"));
    const ids2 = (await res2.json()).events.map((e: { id: string }) => e.id);
    expect(ids2).not.toContain("a_pref_only_out");
  });

  it("event payload shape includes the scope-relevant fields", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;

    await seedAssignment({
      id: "a_shape",
      teamId: baseline.teams.t1.id,
      preferredDate: new Date("2026-04-15T10:00:00.000Z"),
    });

    const res = await GET(makeReq("start=2026-04-01&end=2026-04-30"));
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    const ev = body.events[0];
    expect(ev).toMatchObject({
      id: "a_shape",
      teamId: baseline.teams.t1.id,
      status: "scheduled",
    });
    // Dates serialize as ISO strings (or null).
    expect(typeof ev.preferredDate).toBe("string");
    expect(ev.calendarDate).toBeNull();
  });
});
