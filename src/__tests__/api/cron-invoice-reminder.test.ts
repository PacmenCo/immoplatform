import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { GET } from "@/app/api/cron/invoice-reminder/route";
import { prisma, resetDb, disconnectDb, auditMeta } from "../_helpers/db";

// Integration tier: exercises the Bearer gate, env configuration failure,
// date gating, force-override, idempotency guard (already-sent-today),
// and the audit contract.
//
// Time handling: the route uses `new Date()` for the date-gate + for
// startOfDay in the idempotency check. Vitest fake timers let us pin
// `new Date()` deterministically — BUT Prisma's `@default(now())` for
// auditLog.at runs at the DB level (SQLite CURRENT_TIMESTAMP) and is NOT
// affected by fake timers. Because of that, the idempotency test can't
// just "force-fire twice on a pinned target date": the first fire's audit
// row has a real-clock `at`, and the route's `alreadySentToday(pinnedNow)`
// computes startOfDay from the pinned value — the two don't intersect.
// Instead we seed the prior audit row manually with the same `at` that
// `alreadySentToday` will compare against. The whole point of the guard
// is "did we write one today", and seeding makes that precondition
// explicit.

const URL_BASE = "http://localhost/api/cron/invoice-reminder";
const NON_TARGET = new Date("2026-04-10T12:00:00.000Z"); // Apr 27 is the April target
const TARGET_DATE = new Date("2026-04-27T09:00:00.000Z"); // end-of-April − 3 days

function makeReq(opts: { bearer?: string | null; query?: string } = {}): Request {
  const url = opts.query ? `${URL_BASE}?${opts.query}` : URL_BASE;
  const headers: Record<string, string> = {};
  if (opts.bearer !== null && opts.bearer !== undefined) {
    headers.authorization = `Bearer ${opts.bearer}`;
  }
  return new Request(url, { headers });
}

describe("GET /api/cron/invoice-reminder", () => {
  beforeEach(async () => {
    await resetDb();
    vi.stubEnv("INVOICE_REMINDER_EMAIL", "admin@immo.test");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
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
    const res = await GET(makeReq({ bearer: "nope" }));
    expect(res.status).toBe(401);
  });

  it("500 when INVOICE_REMINDER_EMAIL is not configured", async () => {
    vi.stubEnv("INVOICE_REMINDER_EMAIL", "");
    const res = await GET(makeReq({ bearer: process.env.CRON_SECRET! }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/INVOICE_REMINDER_EMAIL/);
  });

  it("non-target date → fired:false, no invoice_reminder.sent audit row", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NON_TARGET);

    const res = await GET(makeReq({ bearer: process.env.CRON_SECRET! }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.fired).toBe(false);
    expect(body.nextFireOn).toBeDefined();

    const sent = await prisma.auditLog.findMany({
      where: { verb: "invoice_reminder.sent" },
    });
    expect(sent).toHaveLength(0);

    // A .skipped audit with reason:"not-due" is expected.
    const skipped = await prisma.auditLog.findMany({
      where: { verb: "invoice_reminder.skipped" },
    });
    expect(skipped).toHaveLength(1);
    const meta = auditMeta(skipped[0].metadata);
    expect(meta.reason).toBe("not-due");
  });

  it("?force=1 fires on a non-target date and writes invoice_reminder.sent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NON_TARGET);

    const res = await GET(
      makeReq({ bearer: process.env.CRON_SECRET!, query: "force=1" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.fired).toBe(true);
    expect(typeof body.monthLabel).toBe("string");

    const sent = await prisma.auditLog.findMany({
      where: { verb: "invoice_reminder.sent" },
    });
    expect(sent).toHaveLength(1);
    const meta = auditMeta(sent[0].metadata);
    expect(meta.recipient).toBe("admin@immo.test");
    expect(meta.forced).toBe(true);
    expect(typeof meta.monthLabel).toBe("string");
  });

  it("idempotency: pre-existing invoice_reminder.sent for today → second fire skips", async () => {
    // Pin clock to the target date so the natural fire would be allowed.
    // Then seed an audit row `at` the same pinned day: the handler's
    // `alreadySentToday` trips and skips.
    vi.useFakeTimers();
    vi.setSystemTime(TARGET_DATE);

    // Seed the prior sent audit — same UTC day as TARGET_DATE. We set `at`
    // explicitly so the row lives inside `startOfDay(TARGET_DATE)`.
    await prisma.auditLog.create({
      data: {
        verb: "invoice_reminder.sent",
        at: new Date("2026-04-27T08:00:00.000Z"),
        metadata: JSON.stringify({
          recipient: "admin@immo.test",
          monthLabel: "April 2026",
          forced: false,
        }),
      },
    });

    // Run without force — date gate passes (on target), but already-sent
    // guard now trips and returns early.
    const res = await GET(makeReq({ bearer: process.env.CRON_SECRET! }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.fired).toBe(false);
    expect(body.reason).toBe("already-sent-today");

    // Still only one sent row (we didn't add another).
    const sent = await prisma.auditLog.findMany({
      where: { verb: "invoice_reminder.sent" },
    });
    expect(sent).toHaveLength(1);

    // A skipped row with reason already-sent-today is written.
    const skipped = await prisma.auditLog.findMany({
      where: { verb: "invoice_reminder.skipped" },
    });
    const already = skipped.filter((r) => {
      const m = auditMeta(r.metadata);
      return m.reason === "already-sent-today";
    });
    expect(already).toHaveLength(1);
  });

  it("successful fire writes an invoice_reminder.sent audit row with expected metadata", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(TARGET_DATE);

    const res = await GET(makeReq({ bearer: process.env.CRON_SECRET! }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fired).toBe(true);

    const sent = await prisma.auditLog.findMany({
      where: { verb: "invoice_reminder.sent" },
    });
    expect(sent).toHaveLength(1);
    const meta = auditMeta(sent[0].metadata);
    // Natural fire → forced: false; recipient + monthLabel present.
    expect(meta.forced).toBe(false);
    expect(meta.recipient).toBe("admin@immo.test");
    expect(typeof meta.monthLabel).toBe("string");
  });
});
