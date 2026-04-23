import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/update-assignment-statuses/route";
import { prisma, resetDb, disconnectDb } from "../_helpers/db";
import { seedBaseline, seedAssignment } from "../_helpers/fixtures";

// Integration tier: hits the real Next route handler with real Prisma against
// a fresh SQLite DB. Proves the Bearer gate, dry-run semantics, the
// claim-then-update race guard, and the audit side effect all behave.
//
// Calls `GET(req)` directly — the route exports a plain function, so we skip
// any HTTP layer and don't need to mock next/headers. Auth here is Bearer,
// not cookie, so the `authorization` header is sufficient.

const URL_BASE = "http://localhost/api/cron/update-assignment-statuses";

function makeReq(opts: { bearer?: string | null; query?: string } = {}): Request {
  const url = opts.query ? `${URL_BASE}?${opts.query}` : URL_BASE;
  const headers: Record<string, string> = {};
  if (opts.bearer !== null && opts.bearer !== undefined) {
    headers.authorization = `Bearer ${opts.bearer}`;
  }
  return new Request(url, { headers });
}

describe("GET /api/cron/update-assignment-statuses", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await disconnectDb();
  });

  it("401 when Authorization header is missing", async () => {
    const res = await GET(makeReq({ bearer: null }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized." });
  });

  it("401 when Bearer secret is wrong", async () => {
    const res = await GET(makeReq({ bearer: "not-the-secret" }));
    expect(res.status).toBe(401);
  });

  it("200 with empty payload when no candidate rows exist", async () => {
    await seedBaseline();
    const res = await GET(makeReq({ bearer: process.env.CRON_SECRET! }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, found: 0, updated: 0, ids: [] });
  });

  it("promotes a scheduled assignment whose preferredDate has passed", async () => {
    const baseline = await seedBaseline();
    const past = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    const a = await seedAssignment({
      id: "a_past_sched",
      status: "scheduled",
      teamId: baseline.teams.t1.id,
      preferredDate: past,
    });

    const res = await GET(makeReq({ bearer: process.env.CRON_SECRET! }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.found).toBe(1);
    expect(body.updated).toBe(1);
    expect(body.ids).toEqual([a.id]);

    // DB reflects the transition.
    const row = await prisma.assignment.findUnique({ where: { id: a.id } });
    expect(row?.status).toBe("in_progress");
  });

  it("?dry=1 returns candidate ids but leaves the DB untouched", async () => {
    const baseline = await seedBaseline();
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const a = await seedAssignment({
      id: "a_dry",
      status: "scheduled",
      teamId: baseline.teams.t1.id,
      preferredDate: past,
    });

    const res = await GET(
      makeReq({ bearer: process.env.CRON_SECRET!, query: "dry=1" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.dryRun).toBe(true);
    expect(body.found).toBe(1);
    expect(body.ids).toEqual([a.id]);

    // No DB mutation + no audit side effect.
    const row = await prisma.assignment.findUnique({ where: { id: a.id } });
    expect(row?.status).toBe("scheduled");
    const audits = await prisma.auditLog.findMany({
      where: { verb: "assignment.started" },
    });
    expect(audits).toHaveLength(0);
  });

  it("ignores future-dated assignments (preferredDate >= now)", async () => {
    const baseline = await seedBaseline();
    const future = new Date(Date.now() + 60 * 60 * 1000);
    await seedAssignment({
      id: "a_future",
      status: "scheduled",
      teamId: baseline.teams.t1.id,
      preferredDate: future,
    });

    const res = await GET(makeReq({ bearer: process.env.CRON_SECRET! }));
    const body = await res.json();
    expect(body.found).toBe(0);
    expect(body.updated).toBe(0);
  });

  it("ignores assignments with null preferredDate", async () => {
    const baseline = await seedBaseline();
    await seedAssignment({
      id: "a_no_date",
      status: "scheduled",
      teamId: baseline.teams.t1.id,
      preferredDate: null,
    });

    const res = await GET(makeReq({ bearer: process.env.CRON_SECRET! }));
    const body = await res.json();
    expect(body.found).toBe(0);
  });

  it("ignores assignments already past 'scheduled'", async () => {
    const baseline = await seedBaseline();
    const past = new Date(Date.now() - 60 * 60 * 1000);
    // in_progress with a past preferredDate must not be touched — the route
    // filters where: status: "scheduled".
    await seedAssignment({
      id: "a_already_ip",
      status: "in_progress",
      teamId: baseline.teams.t1.id,
      preferredDate: past,
    });

    const res = await GET(makeReq({ bearer: process.env.CRON_SECRET! }));
    const body = await res.json();
    expect(body.found).toBe(0);
  });

  it("writes an assignment.started audit row per transition", async () => {
    const baseline = await seedBaseline();
    const past = new Date(Date.now() - 60 * 60 * 1000);
    const a = await seedAssignment({
      id: "a_audited",
      status: "scheduled",
      teamId: baseline.teams.t1.id,
      preferredDate: past,
    });

    await GET(makeReq({ bearer: process.env.CRON_SECRET! }));

    const audits = await prisma.auditLog.findMany({
      where: { verb: "assignment.started", objectId: a.id },
    });
    expect(audits).toHaveLength(1);
    const meta = JSON.parse(audits[0].metadata ?? "{}");
    expect(meta.from).toBe("scheduled");
    expect(meta.to).toBe("in_progress");
    expect(meta.trigger).toBe("cron");
    expect(typeof meta.preferredDate).toBe("string");
  });

  it("per-row claim is race-safe: second sequential run sees no candidates", async () => {
    // Simulates a scheduler double-fire. The first call flips scheduled →
    // in_progress; the second should see zero candidates because the
    // per-row `updateMany where: status: "scheduled"` predicate no longer
    // matches (and findMany filters on status: "scheduled" at the top of
    // the handler too). This is the critical idempotency contract.
    const baseline = await seedBaseline();
    const past = new Date(Date.now() - 60 * 60 * 1000);
    await seedAssignment({
      id: "a_race_1",
      status: "scheduled",
      teamId: baseline.teams.t1.id,
      preferredDate: past,
    });
    await seedAssignment({
      id: "a_race_2",
      status: "scheduled",
      teamId: baseline.teams.t1.id,
      preferredDate: past,
    });

    const first = await GET(makeReq({ bearer: process.env.CRON_SECRET! }));
    const firstBody = await first.json();
    expect(firstBody.updated).toBe(2);

    const second = await GET(makeReq({ bearer: process.env.CRON_SECRET! }));
    const secondBody = await second.json();
    expect(secondBody.found).toBe(0);
    expect(secondBody.updated).toBe(0);
    expect(secondBody.ids).toEqual([]);

    // Audit rows should exist exactly once per row despite two invocations.
    const audits = await prisma.auditLog.findMany({
      where: { verb: "assignment.started" },
    });
    expect(audits).toHaveLength(2);
  });

  it("processes multiple candidates in one pass", async () => {
    const baseline = await seedBaseline();
    const past = new Date(Date.now() - 60 * 60 * 1000);
    const ids = ["a_m1", "a_m2", "a_m3"];
    for (const id of ids) {
      await seedAssignment({
        id,
        status: "scheduled",
        teamId: baseline.teams.t1.id,
        preferredDate: past,
      });
    }

    const res = await GET(makeReq({ bearer: process.env.CRON_SECRET! }));
    const body = await res.json();
    expect(body.found).toBe(3);
    expect(body.updated).toBe(3);
    expect(body.ids.sort()).toEqual(ids.sort());
  });
});
