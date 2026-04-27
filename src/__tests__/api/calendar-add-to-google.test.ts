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
import { makeSession } from "../_helpers/session";

// Defense-in-depth gate audit: this route used to gate only on session +
// connected-calendar-account. The OAuth callback already restricts who
// can connect (admin/staff), so the role check here is regression
// insurance for the day someone broadens that gate. The canViewAssignment
// check is belt-and-braces against the same hypothetical: even if a
// non-admin/staff user somehow has a CalendarAccount row, they should
// never be able to push an arbitrary assignment's address/contacts/notes
// into their own personal Google calendar.
//
// `vi.mock` for `@/lib/auth` lets us control session inside the route
// without dragging the cookie/AsyncLocalStorage plumbing into the test.
// `vi.mock` for `@/lib/calendar/google` swaps the real Google API call
// (which would hit the network) for a deterministic stub.

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

// Hoisted spy — lets gate tests assert the Google API was NOT invoked. Without
// this, a future refactor that moves the role check after the Google call
// would still pass the 403/404 status assertions while the data leak ran.
const { createEventSpy } = vi.hoisted(() => ({
  createEventSpy: vi.fn(async () => "evt_stub_12345"),
}));

vi.mock("@/lib/calendar/google", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/calendar/google")>(
      "@/lib/calendar/google",
    );
  return {
    ...actual,
    createPersonalGoogleEvent: createEventSpy,
  };
});

import { GET } from "@/app/api/calendar/add-to-google/route";

const URL_BASE = "http://localhost/api/calendar/add-to-google";

function makeReq(query: string): NextRequest {
  return new Request(`${URL_BASE}?${query}`) as unknown as NextRequest;
}

async function seedConnectedGoogleAccount(userId: string): Promise<string> {
  const acc = await prisma.calendarAccount.create({
    data: {
      userId,
      provider: "google",
      providerAccountEmail: `${userId}@google.local`,
      accessTokenCipher: "test-cipher",
      refreshTokenCipher: "test-refresh-cipher",
      scope: "https://www.googleapis.com/auth/calendar.events",
      expiresAt: new Date(Date.now() + 3600_000),
    },
    select: { id: true },
  });
  return acc.id;
}

describe("GET /api/calendar/add-to-google", () => {
  beforeEach(async () => {
    await resetDb();
    currentSession = null;
    createEventSpy.mockClear();
  });
  afterAll(async () => {
    await disconnectDb();
    vi.restoreAllMocks();
  });

  // ─── Role gate (NEW) ─────────────────────────────────────────────

  it("realtor → 403 even with a connected calendar account", async () => {
    // Realtor doesn't get a calendar account through the normal OAuth flow
    // (initiate route is gated to admin/staff). This test simulates the
    // "what if that gate was loosened" case: even with an account row in
    // the DB, the add-to-google route must refuse on its own role gate.
    const baseline = await seedBaseline();
    currentSession = baseline.realtor;
    await seedConnectedGoogleAccount(baseline.realtor.user.id);
    const a = await seedAssignment({
      teamId: baseline.teams.t1.id,
      createdById: baseline.realtor.user.id,
      preferredDate: new Date("2026-05-01T10:00:00.000Z"),
    });

    const res = await GET(makeReq(`a=${a.id}`));
    expect(res.status).toBe(403);
    expect(await res.text()).toMatch(/admin and staff/i);
    // Critical: prove the gate runs BEFORE any data egress to Google.
    expect(createEventSpy).not.toHaveBeenCalled();
  });

  it("freelancer → 403 even with a connected calendar account", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.freelancer;
    await seedConnectedGoogleAccount(baseline.freelancer.user.id);
    const a = await seedAssignment({
      freelancerId: baseline.freelancer.user.id,
      preferredDate: new Date("2026-05-01T10:00:00.000Z"),
    });

    const res = await GET(makeReq(`a=${a.id}`));
    expect(res.status).toBe(403);
    expect(await res.text()).toMatch(/admin and staff/i);
    expect(createEventSpy).not.toHaveBeenCalled();
  });

  it("realtor with no calendar account → 403 (role check fires before account check)", async () => {
    // Confirms order-of-operations: role gate runs before the
    // account-redirect branch. Without this the route would 302 a realtor
    // to the connect-google settings page and only the OAuth initiate
    // route would slam the door — fragile.
    const baseline = await seedBaseline();
    currentSession = baseline.realtor;
    const a = await seedAssignment({
      teamId: baseline.teams.t1.id,
      createdById: baseline.realtor.user.id,
      preferredDate: new Date("2026-05-01T10:00:00.000Z"),
    });

    const res = await GET(makeReq(`a=${a.id}`));
    expect(res.status).toBe(403);
    expect(createEventSpy).not.toHaveBeenCalled();
  });

  // ─── Existing behaviors that must stay intact ───────────────────

  it("admin with connected account + viewable assignment → redirects with calendar-added=1", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;
    await seedConnectedGoogleAccount(baseline.admin.user.id);
    const a = await seedAssignment({
      teamId: baseline.teams.t1.id,
      preferredDate: new Date("2026-05-01T10:00:00.000Z"),
    });

    const res = await GET(makeReq(`a=${a.id}`));
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain(`/dashboard/assignments/${a.id}`);
    expect(loc).toContain("calendar-added=1");

    // Side-effect: the AssignmentCalendarEvent row is persisted so the
    // idempotency branch fires on a second click.
    const stored = await prisma.assignmentCalendarEvent.findFirst({
      where: { assignmentId: a.id },
    });
    expect(stored).not.toBeNull();
    expect(stored?.providerEventId).toBe("evt_stub_12345");
  });

  it("staff with connected account + viewable assignment → success path", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.staff;
    await seedConnectedGoogleAccount(baseline.staff.user.id);
    const a = await seedAssignment({
      teamId: baseline.teams.t1.id,
      preferredDate: new Date("2026-05-01T10:00:00.000Z"),
    });

    const res = await GET(makeReq(`a=${a.id}`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("calendar-added=1");
  });

  it("admin with no `a` query param → 400", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;

    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/missing assignment id/i);
  });

  it("admin with no connected calendar account → redirects to connect page", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;
    const a = await seedAssignment({
      teamId: baseline.teams.t1.id,
      preferredDate: new Date("2026-05-01T10:00:00.000Z"),
    });

    const res = await GET(makeReq(`a=${a.id}`));
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/dashboard/settings/integrations/google-calendar");
    expect(loc).toContain("need-connect=1");
    expect(loc).toContain(`then=${encodeURIComponent(a.id)}`);
  });

  it("admin with disconnected calendar account → redirects to connect page (treated as missing)", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;
    const acctId = await seedConnectedGoogleAccount(baseline.admin.user.id);
    await prisma.calendarAccount.update({
      where: { id: acctId },
      data: { disconnectedAt: new Date() },
    });
    const a = await seedAssignment({
      teamId: baseline.teams.t1.id,
      preferredDate: new Date("2026-05-01T10:00:00.000Z"),
    });

    const res = await GET(makeReq(`a=${a.id}`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("need-connect=1");
  });

  it("admin with connected account + nonexistent assignment id → 404", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;
    await seedConnectedGoogleAccount(baseline.admin.user.id);

    const res = await GET(makeReq("a=does_not_exist"));
    expect(res.status).toBe(404);
  });

  it("admin with connected account + assignment lacking a date → redirects with calendar-error=no-date", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;
    await seedConnectedGoogleAccount(baseline.admin.user.id);
    const a = await seedAssignment({
      teamId: baseline.teams.t1.id,
      preferredDate: null, // no date → buildEventPayload returns null
    });

    const res = await GET(makeReq(`a=${a.id}`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("calendar-error=no-date");
  });

  it("admin re-adding the same assignment → idempotent redirect with calendar-added=already", async () => {
    const baseline = await seedBaseline();
    currentSession = baseline.admin;
    const acctId = await seedConnectedGoogleAccount(baseline.admin.user.id);
    const a = await seedAssignment({
      teamId: baseline.teams.t1.id,
      preferredDate: new Date("2026-05-01T10:00:00.000Z"),
    });
    await prisma.assignmentCalendarEvent.create({
      data: {
        assignmentId: a.id,
        calendarAccountId: acctId,
        providerEventId: "evt_already_there",
      },
    });

    const res = await GET(makeReq(`a=${a.id}`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("calendar-added=already");

    // No duplicate row was inserted.
    const count = await prisma.assignmentCalendarEvent.count({
      where: { assignmentId: a.id, calendarAccountId: acctId },
    });
    expect(count).toBe(1);
  });

  // ─── canViewAssignment defense layer ─────────────────────────────

  it("hypothetical: when a non-admin/staff role somehow holds a calendar account, canViewAssignment still blocks ID guessing", async () => {
    // The role gate is the primary defense. canViewAssignment is the
    // belt-and-braces second layer. We can't reach the second layer from
    // the route's normal flow (the role gate fires first), but we still
    // assert it exists by directly importing it and verifying it would
    // reject a non-scope assignment for a freelancer who isn't on the
    // row. If the route ever drops the role gate, this verifies the
    // remaining gate would still hold.
    const { canViewAssignment } = await import("@/lib/permissions");

    const baseline = await seedBaseline();
    // Assignment that the freelancer is NOT assigned to and whose team
    // they are NOT a member of.
    const a = await seedAssignment({
      teamId: baseline.teams.t2.id,
      preferredDate: new Date("2026-05-01T10:00:00.000Z"),
    });
    const fresh = await prisma.assignment.findUniqueOrThrow({
      where: { id: a.id },
      select: { teamId: true, freelancerId: true, createdById: true },
    });
    const allowed = await canViewAssignment(baseline.freelancer, fresh);
    expect(allowed).toBe(false);
  });

  it("hypothetical: a realtor on a different team also fails canViewAssignment", async () => {
    const { canViewAssignment } = await import("@/lib/permissions");

    const baseline = await seedBaseline();
    const otherRealtor = await makeSession({
      role: "realtor",
      userId: "u_other_realtor",
      activeTeamId: baseline.teams.t2.id,
      membershipTeams: [{ teamId: baseline.teams.t2.id, teamRole: "owner" }],
    });
    const a = await seedAssignment({
      teamId: baseline.teams.t1.id,
      createdById: baseline.realtor.user.id,
      preferredDate: new Date("2026-05-01T10:00:00.000Z"),
    });
    const fresh = await prisma.assignment.findUniqueOrThrow({
      where: { id: a.id },
      select: { teamId: true, freelancerId: true, createdById: true },
    });
    expect(await canViewAssignment(otherRealtor, fresh)).toBe(false);
  });
});
