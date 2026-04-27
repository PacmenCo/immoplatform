import { beforeEach, describe, expect, it } from "vitest";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedBaseline, seedAssignment } from "../_helpers/fixtures";
import { __resetRequestContext } from "../_helpers/next-headers-stub";

// Defense-in-depth contract pin: Prisma parameterizes every where/contains
// query, so SQL injection via text fields shouldn't be reachable. These
// tests confirm that with adversarial payloads end-to-end against the same
// Postgres test database the action suite uses. If any test here fails, it
// means a code path bypassed the ORM (raw query, dynamic-key where, etc.)
// and a real SQL execution happened — which is what we're guarding against.
//
// Coverage approach:
//   1. Plant rows with classic injection payloads in every user-text column.
//      Confirm the payload is stored verbatim.
//   2. Run the same search queries the dashboard runs (contains: w) with
//      the payload as the search term. Confirm: query returns successfully,
//      no extra rows leak, no SQL syntax error escapes.
//   3. LIKE-wildcard sanity: `%` and `_` are search metachars but NOT
//      injection vectors. Document the behavior so a future reviewer who
//      sees it won't mistake it for a vuln.
//
// Each payload is a separate `it.each` case so a single failure pinpoints
// which payload triggered it.

setupTestDb();

beforeEach(() => {
  __resetRequestContext();
});

const INJECTION_PAYLOADS: Array<[string, string]> = [
  // [label, payload] — label is shown in the test name on failure.
  ["bobby-tables", "Robert'); DROP TABLE assignments; --"],
  ["union-leak", "' UNION SELECT email, passwordHash FROM users -- "],
  ["tautology", "' OR '1'='1"],
  ["sleep-blind", "' AND SLEEP(5) -- "],
  ["multi-statement", "1; DELETE FROM users WHERE 1=1 --"],
  ["dollar-quote", "$$); DROP TABLE assignments; SELECT $$"],
  ["backslash-escape", "\\'\\; "],
];

describe("SQL injection — text fields are stored verbatim, not interpreted", () => {
  it.each(INJECTION_PAYLOADS)(
    "assignment.address survives [%s] payload as a literal",
    async (_label, payload) => {
      const baseline = await seedBaseline();
      const a = await prisma.assignment.create({
        data: {
          reference: `ASG-INJ-${Math.random().toString(36).slice(2, 10)}`,
          status: "scheduled",
          address: payload,
          city: "City",
          postal: "1000",
          ownerName: "Test",
          teamId: baseline.teams.t1.id,
          createdById: baseline.realtor.user.id,
          services: { create: [{ serviceKey: "asbestos", unitPriceCents: 25000 }] },
        },
      });
      const fresh = await prisma.assignment.findUniqueOrThrow({ where: { id: a.id } });
      expect(fresh.address).toBe(payload);
    },
  );

  it.each(INJECTION_PAYLOADS)(
    "user.firstName survives [%s] payload as a literal",
    async (label, payload) => {
      const u = await prisma.user.create({
        data: {
          email: `inj-${label}-${Date.now()}@test.local`,
          role: "realtor",
          firstName: payload,
          lastName: payload,
        },
      });
      const fresh = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(fresh.firstName).toBe(payload);
      expect(fresh.lastName).toBe(payload);
    },
  );

  it.each(INJECTION_PAYLOADS)(
    "comment.body survives [%s] payload as a literal",
    async (_label, payload) => {
      const baseline = await seedBaseline();
      const a = await seedAssignment({
        teamId: baseline.teams.t1.id,
        createdById: baseline.realtor.user.id,
      });
      const c = await prisma.assignmentComment.create({
        data: {
          assignmentId: a.id,
          authorId: baseline.realtor.user.id,
          body: payload,
        },
      });
      const fresh = await prisma.assignmentComment.findUniqueOrThrow({ where: { id: c.id } });
      expect(fresh.body).toBe(payload);
    },
  );
});

describe("SQL injection — search queries (`contains` operator) are parameterized", () => {
  it.each(INJECTION_PAYLOADS)(
    "search by [%s] payload returns 0 rows on a clean DB (no tautology hit)",
    async (_label, payload) => {
      const baseline = await seedBaseline();
      // Plant a benign assignment so any non-injection-related result would surface.
      await seedAssignment({
        teamId: baseline.teams.t1.id,
        createdById: baseline.realtor.user.id,
      });

      // Exact shape from src/app/dashboard/assignments/page.tsx:145.
      // If injection had worked, "' OR '1'='1" would match every row.
      // Here it returns 0 because Prisma binds the payload as a literal.
      const matches = await prisma.assignment.findMany({
        where: {
          OR: [
            { reference: { contains: payload, mode: "insensitive" } },
            { address: { contains: payload, mode: "insensitive" } },
            { city: { contains: payload, mode: "insensitive" } },
            { postal: { contains: payload, mode: "insensitive" } },
          ],
        },
      });
      expect(matches.length).toBe(0);
    },
  );

  it("search payload that IS substring-present matches via literal-string semantics only", async () => {
    const baseline = await seedBaseline();
    const literal = "'; DROP TABLE--";
    const a = await prisma.assignment.create({
      data: {
        reference: `ASG-INJ-LIT-${Math.random().toString(36).slice(2, 10)}`,
        status: "scheduled",
        address: `Real address with ${literal} embedded`,
        city: "City",
        postal: "1000",
        ownerName: "Test",
        teamId: baseline.teams.t1.id,
        createdById: baseline.realtor.user.id,
        services: { create: [{ serviceKey: "asbestos", unitPriceCents: 25000 }] },
      },
    });
    const matches = await prisma.assignment.findMany({
      where: { address: { contains: literal, mode: "insensitive" } },
    });
    expect(matches.length).toBe(1);
    expect(matches[0]!.id).toBe(a.id);
  });
});

describe("LIKE-wildcard semantics — % and _ are search metachars, NOT injection", () => {
  // Document expected behavior: Prisma's `contains` wraps the value in % on
  // both sides, so a user typing `%` matches everything (subject to the
  // outer scope filters). This is wildcard-leak, NOT SQL injection — same
  // row set the user could already see via a normal search. Worth knowing
  // about because a reviewer seeing "user input goes into LIKE query" might
  // mistake it for SQL injection. Adding a separate sanitizer for % / _
  // would tighten search semantics but isn't a security fix.
  it("'%' as a search term broadens the match set (documented behavior)", async () => {
    const baseline = await seedBaseline();
    await seedAssignment({
      teamId: baseline.teams.t1.id,
      createdById: baseline.realtor.user.id,
    });
    await seedAssignment({
      teamId: baseline.teams.t1.id,
      createdById: baseline.realtor.user.id,
    });
    const matches = await prisma.assignment.findMany({
      where: { address: { contains: "%", mode: "insensitive" } },
    });
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
