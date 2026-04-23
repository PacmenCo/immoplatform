import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, resetDb, disconnectDb } from "./db";
import { makeSession } from "./session";
import { seedBaseline } from "./fixtures";

// Infrastructure-level tests. These prove that the DB helper, session
// factory, and fixture seeder all work against the real Prisma schema.
// Failing here means every downstream suite is broken — it's a load-bearing
// smoke.

describe("test infrastructure", () => {
  beforeAll(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await disconnectDb();
  });

  it("resetDb applies the Prisma schema to the in-memory DB", async () => {
    // If the schema didn't apply, the query errors with "no such table".
    const count = await prisma.user.count();
    expect(count).toBe(0);
  });

  it("makeSession persists a user + session and returns the shape callers expect", async () => {
    const s = await makeSession({ role: "admin", userId: "u_infra" });
    expect(s.user.id).toBe("u_infra");
    expect(s.user.role).toBe("admin");
    expect(s).not.toHaveProperty("user.passwordHash");
    // Session row is in the DB too.
    const row = await prisma.session.findUnique({ where: { id: s.id } });
    expect(row?.userId).toBe("u_infra");
  });

  it("seedBaseline inserts 4 users, 2 teams, and the service catalog", async () => {
    await resetDb();
    const baseline = await seedBaseline();
    expect(await prisma.user.count()).toBe(4);
    expect(await prisma.team.count()).toBe(2);
    expect(await prisma.service.count()).toBe(4);
    expect(baseline.realtor.user.role).toBe("realtor");
    expect(baseline.realtor.activeTeamId).toBe(baseline.teams.t1.id);
  });
});
