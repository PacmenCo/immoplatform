import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { switchToAccount } from "@/app/actions/account-switcher";
import { prisma, setupTestDb } from "../_helpers/db";
import {
  __resetRequestContext,
  __setCookie,
  __getCookie,
} from "../_helpers/next-headers-stub";
import { captureRedirect } from "../_helpers/next-navigation-stub";

// The action `switchToAccount`:
//   - hard-rejects in production (env-guard)
//   - requires the current session-holder's email is in SWITCHER_GROUP
//   - requires the target email is in SWITCHER_GROUP
//   - requires the target user exists + not soft-deleted
//   - revokes the current session, creates a fresh one for the target user
//   - writes one audit row tagged user.account_switched
//   - redirects to /dashboard/assignments

setupTestDb();

const FOUNDER_EMAIL = "jordan@asbestexperts.be";
const TEST_REALTOR_EMAIL = "test-realtor@immo.test";
const TEST_FREELANCER_EMAIL = "test-freelancer@immo.test";
const OUTSIDER_EMAIL = "stranger@example.com";

async function seedUser(email: string, opts: { id?: string; role?: "admin" | "staff" | "realtor" | "freelancer"; deletedAt?: Date | null } = {}) {
  return prisma.user.create({
    data: {
      id: opts.id ?? `u_${email.replace(/[^\w]/g, "_")}`,
      email,
      role: opts.role ?? "realtor",
      firstName: "Test",
      lastName: "User",
      passwordHash: null,
      deletedAt: opts.deletedAt ?? null,
    },
  });
}

async function seedSessionFor(user: { id: string }): Promise<{ sessionId: string }> {
  const sessionId = `s_${Math.random().toString(36).slice(2)}`;
  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      lastSeenAt: new Date(),
    },
  });
  __setCookie("immo_session", sessionId);
  return { sessionId };
}

beforeEach(() => {
  __resetRequestContext();
  // Restore NODE_ENV after env-guard tests fiddle with it.
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("switchToAccount — happy path", () => {
  it("revokes current session, creates a new one for the target, redirects to /dashboard/assignments", async () => {
    const founder = await seedUser(FOUNDER_EMAIL, { id: "u_jordan", role: "admin" });
    const target = await seedUser(TEST_REALTOR_EMAIL, { id: "u_test_realtor", role: "realtor" });
    const { sessionId: oldSessionId } = await seedSessionFor(founder);

    const redirectUrl = await captureRedirect(() => switchToAccount(TEST_REALTOR_EMAIL));
    expect(redirectUrl).toBe("/dashboard/assignments");

    const oldSession = await prisma.session.findUniqueOrThrow({ where: { id: oldSessionId } });
    expect(oldSession.revokedAt).toBeInstanceOf(Date);

    const newSessionId = __getCookie("immo_session");
    expect(newSessionId).toBeTruthy();
    expect(newSessionId).not.toBe(oldSessionId);

    const newSession = await prisma.session.findUniqueOrThrow({ where: { id: newSessionId! } });
    expect(newSession.userId).toBe(target.id);
    expect(newSession.revokedAt).toBeNull();
  });

  it("writes a user.account_switched audit row attributed to the original (real) user", async () => {
    const founder = await seedUser(FOUNDER_EMAIL, { id: "u_jordan2", role: "admin" });
    await seedUser(TEST_FREELANCER_EMAIL, { id: "u_test_freelancer", role: "freelancer" });
    await seedSessionFor(founder);

    await captureRedirect(() => switchToAccount(TEST_FREELANCER_EMAIL));

    const auditRows = await prisma.auditLog.findMany({
      where: { actorId: founder.id, verb: "user.account_switched" },
    });
    expect(auditRows).toHaveLength(1);
    const meta = auditRows[0].metadata as Record<string, unknown> | null;
    expect(meta?.fromEmail).toBe(FOUNDER_EMAIL);
    expect(meta?.toEmail).toBe(TEST_FREELANCER_EMAIL);
  });

  it("supports test users switching back to the founder", async () => {
    const founder = await seedUser(FOUNDER_EMAIL, { id: "u_jordan3", role: "admin" });
    const target = await seedUser(TEST_REALTOR_EMAIL, { id: "u_test_realtor3", role: "realtor" });
    await seedSessionFor(target);

    const redirectUrl = await captureRedirect(() => switchToAccount(FOUNDER_EMAIL));
    expect(redirectUrl).toBe("/dashboard/assignments");

    const newSessionId = __getCookie("immo_session");
    const newSession = await prisma.session.findUniqueOrThrow({ where: { id: newSessionId! } });
    expect(newSession.userId).toBe(founder.id);
  });
});

describe("switchToAccount — rejections", () => {
  it("rejects when the current user is NOT in the switcher group", async () => {
    const stranger = await seedUser(OUTSIDER_EMAIL, { id: "u_outsider", role: "realtor" });
    await seedUser(TEST_REALTOR_EMAIL, { id: "u_t_realtor_a", role: "realtor" });
    await seedSessionFor(stranger);

    const res = await switchToAccount(TEST_REALTOR_EMAIL);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not authorised/i);
  });

  it("rejects when the target email is NOT in the switcher group", async () => {
    const founder = await seedUser(FOUNDER_EMAIL, { id: "u_jordan_b", role: "admin" });
    await seedUser(OUTSIDER_EMAIL, { id: "u_outsider_b", role: "realtor" });
    await seedSessionFor(founder);

    const res = await switchToAccount(OUTSIDER_EMAIL);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not in the switcher/i);
  });

  it("rejects when the target user does not exist", async () => {
    const founder = await seedUser(FOUNDER_EMAIL, { id: "u_jordan_c", role: "admin" });
    await seedSessionFor(founder);

    // Target email IS in the group but no User row exists for it.
    const res = await switchToAccount(TEST_REALTOR_EMAIL);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not found|does not exist/i);
  });

  it("rejects when the target user is soft-deleted", async () => {
    const founder = await seedUser(FOUNDER_EMAIL, { id: "u_jordan_d", role: "admin" });
    await seedUser(TEST_REALTOR_EMAIL, {
      id: "u_t_realtor_d",
      role: "realtor",
      deletedAt: new Date(),
    });
    await seedSessionFor(founder);

    const res = await switchToAccount(TEST_REALTOR_EMAIL);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not found|does not exist/i);
  });

  it("rejects without a current session at all", async () => {
    await seedUser(TEST_REALTOR_EMAIL, { id: "u_t_realtor_e", role: "realtor" });
    // No __setCookie call -> no current session.

    const res = await switchToAccount(TEST_REALTOR_EMAIL);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/signed in|not signed/i);
  });

  it("rejects in production (NODE_ENV guard)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const founder = await seedUser(FOUNDER_EMAIL, { id: "u_jordan_e", role: "admin" });
    await seedUser(TEST_REALTOR_EMAIL, { id: "u_t_realtor_f", role: "realtor" });
    await seedSessionFor(founder);

    const res = await switchToAccount(TEST_REALTOR_EMAIL);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/disabled|production/i);
  });

  it("rejects self-targeting (same email as current session)", async () => {
    const founder = await seedUser(FOUNDER_EMAIL, { id: "u_jordan_f", role: "admin" });
    await seedSessionFor(founder);

    const res = await switchToAccount(FOUNDER_EMAIL);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/already|self/i);
  });
});
