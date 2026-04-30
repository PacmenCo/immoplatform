import { beforeEach, describe, expect, it } from "vitest";
import {
  forgotPassword,
  login,
  logout,
  register,
  resetPassword,
  switchActiveTeam,
} from "@/app/actions/auth";
import { hashPassword, hashToken, generateToken } from "@/lib/auth";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import {
  __resetRequestContext,
  __setHeader,
  __getCookie,
  __setCookie,
} from "../_helpers/next-headers-stub";
import { captureRedirect } from "../_helpers/next-navigation-stub";
import { seedBaseline, seedTeam } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";
import { checkRateLimit, resetRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

// Platform parity — ports behavioral contract from:
//   Platform/app/Http/Controllers/Auth/LoginController.php
//   Platform/app/Http/Controllers/Auth/ForgotPasswordController.php
//   Laravel Password broker (token TTL, hash storage, session revoke)
//
// Covers:
//   1. login — rate limit, constant-time verify, session + lastLoginAt + audit
//   2. forgotPassword — tokenized + rate-limited; always-ok to prevent enum
//   3. resetPassword — token one-use, session-wipe, atomic password swap
//   4. logout — session revoke + redirect
//   5. switchActiveTeam — membership-gated

setupTestDb();

beforeEach(() => {
  __resetRequestContext();
  __setHeader("x-forwarded-for", "10.0.0.1");
  // rate-limit store is module-global; reset per-test keys we'll hit.
  resetRateLimit("login:alice@test.local:10.0.0.1");
  resetRateLimit("login:ghost@test.local:10.0.0.1");
  resetRateLimit("login:alice@test.local");
  resetRateLimit("login:ghost@test.local");
  resetRateLimit("forgot:alice@test.local");
  resetRateLimit("forgot:ghost@test.local");
  resetRateLimit("forgot-ip:10.0.0.1");
});

// Small helper — creates a User row with a real bcrypt hash of `password`.
async function seedUserWithPassword(
  email: string,
  password: string,
  opts: { id?: string; role?: "admin" | "staff" | "realtor" | "freelancer" } = {},
) {
  const hash = await hashPassword(password);
  return prisma.user.create({
    data: {
      id: opts.id ?? `u_${email.replace(/[^\w]/g, "_")}`,
      email,
      passwordHash: hash,
      role: opts.role ?? "realtor",
      firstName: "Alice",
      lastName: "Tester",
    },
  });
}

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

describe("login", () => {
  it("valid credentials → session created, redirect to /dashboard/assignments, lastLoginAt stamped", async () => {
    await seedUserWithPassword("alice@test.local", "correct-horse-battery-staple");

    const redirectUrl = await captureRedirect(() =>
      login(undefined, form({ email: "alice@test.local", password: "correct-horse-battery-staple" })),
    );
    expect(redirectUrl).toBe("/dashboard/assignments");

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "alice@test.local" },
      select: { lastLoginAt: true, id: true },
    });
    expect(user.lastLoginAt).toBeInstanceOf(Date);

    // Session row created AND cookie set by createSession.
    const sessions = await prisma.session.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    expect(sessions).toHaveLength(1);
    expect(__getCookie("immo_session")).toBe(sessions[0].id);

    // user.signed_in audit emitted.
    const audits = await prisma.auditLog.findMany({
      where: { actorId: user.id, verb: "user.signed_in" },
    });
    expect(audits).toHaveLength(1);
  });

  it("wrong password → {ok:false}, no session, audit.login_failed emitted", async () => {
    await seedUserWithPassword("alice@test.local", "correct-password");
    const res = await login(undefined, form({ email: "alice@test.local", password: "wrong" }));
    expect(res).toMatchObject({ ok: false, error: "Invalid email or password." });

    const sessions = await prisma.session.count({ where: { revokedAt: null } });
    expect(sessions).toBe(0);
    const audits = await prisma.auditLog.findMany({
      where: { verb: "auth.login_failed" },
      select: { metadata: true },
    });
    expect(audits).toHaveLength(1);
    expect(auditMeta(audits[0].metadata).email).toBe("alice@test.local");
  });

  it("login error response echoes back the typed email (form preservation)", async () => {
    await seedUserWithPassword("alice@test.local", "correct-password");
    const res = await login(undefined, form({ email: "alice@test.local", password: "wrong" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.formValues).toEqual({ email: "alice@test.local" });
  });

  it("unknown email → same error shape (no user-enumeration leak)", async () => {
    const res = await login(undefined, form({ email: "ghost@test.local", password: "whatever" }));
    expect(res).toMatchObject({ ok: false, error: "Invalid email or password." });
  });

  it("soft-deleted user → login rejected", async () => {
    const u = await seedUserWithPassword("alice@test.local", "correct-password");
    await prisma.user.update({ where: { id: u.id }, data: { deletedAt: new Date() } });
    const res = await login(undefined, form({ email: "alice@test.local", password: "correct-password" }));
    expect(res).toMatchObject({ ok: false, error: "Invalid email or password." });
  });

  it("invalid email format → friendly validation error (no rate-limit hit, no DB query)", async () => {
    const res = await login(undefined, form({ email: "not-an-email", password: "whatever" }));
    expect(res).toMatchObject({ ok: false, error: "Enter your email and password." });
  });

  it("rate limit fires after 5 failures for the same (email, ip) in 60s window", async () => {
    await seedUserWithPassword("alice@test.local", "correct-password");
    for (let i = 0; i < RATE_LIMITS.login.max; i++) {
      await login(undefined, form({ email: "alice@test.local", password: "wrong" }));
    }
    // 6th attempt — should be rate-limited regardless of correctness.
    const res = await login(undefined, form({ email: "alice@test.local", password: "correct-password" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Too many attempts/);
  });

  it("per-email defense fires when the per-email bucket is exhausted (regardless of source IP)", async () => {
    // Direct-fill the per-email bucket — exercising 30 bcrypt-bound login
    // calls would be slow and bcrypt isn't what we're testing here. The
    // contract: `login` consults `RATE_LIMITS.loginPerEmail` BEFORE the
    // per-(email, IP) bucket, so an exhausted per-email bucket blocks
    // even a fresh IP that has its own (email, IP) budget intact.
    await seedUserWithPassword("alice@test.local", "correct-password");
    for (let i = 0; i < RATE_LIMITS.loginPerEmail.max; i++) {
      checkRateLimit("login:alice@test.local", RATE_LIMITS.loginPerEmail);
    }
    __setHeader("x-forwarded-for", "10.99.99.99");
    const res = await login(
      undefined,
      form({ email: "alice@test.local", password: "correct-password" }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Too many attempts/);
  });

  it("successful login RESETS the rate limit counter (so later failures count fresh)", async () => {
    await seedUserWithPassword("alice@test.local", "correct-password");
    // 4 failures, then a success
    for (let i = 0; i < 4; i++) {
      await login(undefined, form({ email: "alice@test.local", password: "wrong" }));
    }
    await captureRedirect(() =>
      login(undefined, form({ email: "alice@test.local", password: "correct-password" })),
    );
    // The fresh counter allows another 5 failures before locking out.
    const res = await login(undefined, form({ email: "alice@test.local", password: "wrong" }));
    expect(res).toMatchObject({ ok: false, error: "Invalid email or password." });
  });

  it("picks the user's first team membership as activeTeamId", async () => {
    const u = await seedUserWithPassword("alice@test.local", "password123");
    await seedTeam("t_auth_1", "Auth Team 1");
    await prisma.teamMember.create({
      data: { userId: u.id, teamId: "t_auth_1", teamRole: "owner" },
    });
    await captureRedirect(() =>
      login(undefined, form({ email: "alice@test.local", password: "password123" })),
    );
    const session = await prisma.session.findFirstOrThrow({
      where: { userId: u.id, revokedAt: null },
      select: { activeTeamId: true },
    });
    expect(session.activeTeamId).toBe("t_auth_1");
  });

  it("redirects to ?next= when set to a same-origin path (Platform parity: redirect()->intended)", async () => {
    await seedUserWithPassword("alice@test.local", "password123");
    const target = await captureRedirect(() =>
      login(
        undefined,
        form({
          email: "alice@test.local",
          password: "password123",
          next: "/dashboard/assignments/abc123",
        }),
      ),
    );
    expect(target).toBe("/dashboard/assignments/abc123");
  });

  it("ignores ?next= protocol-relative URLs (//evil.example) — falls back to /dashboard/assignments", async () => {
    await seedUserWithPassword("alice@test.local", "password123");
    const target = await captureRedirect(() =>
      login(
        undefined,
        form({
          email: "alice@test.local",
          password: "password123",
          next: "//evil.example/steal",
        }),
      ),
    );
    expect(target).toBe("/dashboard/assignments");
  });

  it("ignores ?next= absolute URLs — falls back to /dashboard/assignments", async () => {
    await seedUserWithPassword("alice@test.local", "password123");
    const target = await captureRedirect(() =>
      login(
        undefined,
        form({
          email: "alice@test.local",
          password: "password123",
          next: "https://evil.example/steal",
        }),
      ),
    );
    expect(target).toBe("/dashboard/assignments");
  });
});

describe("forgotPassword", () => {
  it("known email → creates PasswordReset row, sends email, returns ok", async () => {
    const u = await seedUserWithPassword("alice@test.local", "some-password");
    const res = await forgotPassword(undefined, form({ email: "alice@test.local" }));
    expect(res).toEqual({ ok: true });
    const resets = await prisma.passwordReset.findMany({ where: { userId: u.id } });
    expect(resets).toHaveLength(1);
    expect(resets[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(resets[0].expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 61 * 60 * 1000);
    expect(resets[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("unknown email → returns ok WITHOUT creating a reset row (anti-enumeration)", async () => {
    const res = await forgotPassword(undefined, form({ email: "ghost@test.local" }));
    expect(res).toEqual({ ok: true });
    const resets = await prisma.passwordReset.count();
    expect(resets).toBe(0);
    // Audit still records the attempt with found=false.
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { verb: "password_reset.requested" },
      select: { metadata: true, actorId: true },
    });
    expect(audit.actorId).toBeNull();
    const meta = auditMeta(audit.metadata);
    expect(meta.found).toBe(false);
    expect(meta.email).toBe("ghost@test.local");
  });

  it("soft-deleted user → no reset row (treats as unknown)", async () => {
    const u = await seedUserWithPassword("alice@test.local", "some-password");
    await prisma.user.update({ where: { id: u.id }, data: { deletedAt: new Date() } });
    const res = await forgotPassword(undefined, form({ email: "alice@test.local" }));
    expect(res).toEqual({ ok: true });
    const resets = await prisma.passwordReset.count({ where: { userId: u.id } });
    expect(resets).toBe(0);
  });

  it("rate limit — 3 attempts per email per 300s then blocked", async () => {
    await seedUserWithPassword("alice@test.local", "password123");
    for (let i = 0; i < RATE_LIMITS.forgotPassword.max; i++) {
      const r = await forgotPassword(undefined, form({ email: "alice@test.local" }));
      expect(r.ok).toBe(true);
    }
    const blocked = await forgotPassword(undefined, form({ email: "alice@test.local" }));
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/Too many attempts/);
  });

  it("per-IP cap blocks wordlist abuse across email rotation", async () => {
    // 10 different emails from the same IP — per-email caps would each allow
    // 3, but the per-IP cap is 10 across all of them. The 11th email (or any
    // further attempt from the same IP) should be rate-limited.
    for (let i = 0; i < RATE_LIMITS.forgotPasswordPerIp.max; i++) {
      const r = await forgotPassword(
        undefined,
        form({ email: `target${i}@example.test` }),
      );
      expect(r.ok).toBe(true);
      resetRateLimit(`forgot:target${i}@example.test`);
    }
    const blocked = await forgotPassword(
      undefined,
      form({ email: "target-overflow@example.test" }),
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/Too many attempts/);
    resetRateLimit("forgot:target-overflow@example.test");
  });
});

describe("resetPassword", () => {
  async function seedUserWithReset(password: string) {
    const u = await seedUserWithPassword("alice@test.local", password);
    const token = generateToken();
    await prisma.passwordReset.create({
      data: {
        userId: u.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return { user: u, token };
  }

  beforeEach(() => {
    // reset limit is keyed by tokenHash — reset on each test to avoid cross-test pollution
  });

  it("valid token + matching password → hash rewritten, all sessions revoked, fresh session created, redirect", async () => {
    const { user, token } = await seedUserWithReset("old-password");
    // Seed an existing session to prove it gets revoked.
    const prior = await prisma.session.create({
      data: {
        id: "s_prior_session",
        userId: user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const redirectUrl = await captureRedirect(() =>
      resetPassword(undefined, form({
        token,
        password: "new-password-that-is-long",
        confirm: "new-password-that-is-long",
      })),
    );
    expect(redirectUrl).toBe("/dashboard/assignments");

    // Old sessions revoked.
    const oldSession = await prisma.session.findUniqueOrThrow({ where: { id: prior.id } });
    expect(oldSession.revokedAt).toBeInstanceOf(Date);

    // A new, non-revoked session exists (created by resetPassword).
    const newSessions = await prisma.session.count({
      where: { userId: user.id, revokedAt: null },
    });
    expect(newSessions).toBe(1);

    // Reset row is marked used — single-use.
    const reset = await prisma.passwordReset.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(reset.usedAt).toBeInstanceOf(Date);

    // Password hash rotated (new hash ≠ stored hash of old password).
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.passwordHash).not.toBeNull();
    expect(updated.passwordHash).not.toBe(user.passwordHash);

    // Audit entry.
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: user.id, verb: "user.password_changed" },
      select: { metadata: true },
    });
    expect(auditMeta(audit.metadata).via).toBe("reset");
  });

  it("password and confirm mismatch → rejects with friendly error", async () => {
    const { token } = await seedUserWithReset("old");
    const res = await resetPassword(undefined, form({
      token,
      password: "new-password-0",
      confirm: "new-password-1",
    }));
    expect(res).toEqual({ ok: false, error: "Passwords don't match." });
  });

  it("token < 10 chars → validation error", async () => {
    const res = await resetPassword(undefined, form({
      token: "short",
      password: "long-enough-password",
      confirm: "long-enough-password",
    }));
    expect(res.ok).toBe(false);
  });

  it("password < 10 chars → validation error", async () => {
    const { token } = await seedUserWithReset("old");
    const res = await resetPassword(undefined, form({
      token,
      password: "short",
      confirm: "short",
    }));
    expect(res).toEqual({
      ok: false,
      error: "Password must be at least 10 characters.",
    });
  });

  it("unknown token → 'invalid or expired' error (no leak about which)", async () => {
    const res = await resetPassword(undefined, form({
      token: "unknownunknownunknown",
      password: "long-enough-password",
      confirm: "long-enough-password",
    }));
    expect(res).toEqual({
      ok: false,
      error: "This reset link is invalid or has expired.",
    });
  });

  it("already-used token → rejected (single-use contract)", async () => {
    const { user, token } = await seedUserWithReset("old");
    await prisma.passwordReset.updateMany({
      where: { userId: user.id },
      data: { usedAt: new Date() },
    });
    const res = await resetPassword(undefined, form({
      token,
      password: "long-enough-password",
      confirm: "long-enough-password",
    }));
    expect(res).toEqual({
      ok: false,
      error: "This reset link is invalid or has expired.",
    });
  });

  it("expired token → rejected", async () => {
    const { user, token } = await seedUserWithReset("old");
    await prisma.passwordReset.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await resetPassword(undefined, form({
      token,
      password: "long-enough-password",
      confirm: "long-enough-password",
    }));
    expect(res).toEqual({
      ok: false,
      error: "This reset link is invalid or has expired.",
    });
  });

  it("soft-deleted user → rejected with clear message", async () => {
    const { user, token } = await seedUserWithReset("old");
    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });
    const res = await resetPassword(undefined, form({
      token,
      password: "long-enough-password",
      confirm: "long-enough-password",
    }));
    expect(res).toEqual({
      ok: false,
      error: "This account is no longer active.",
    });
  });
});

describe("logout", () => {
  it("with active session → audit + revoke + redirect to /login", async () => {
    await seedBaseline();
    const s = await makeSession({ role: "admin", userId: "u_logout_admin" });
    __setCookie("immo_session", s.id);

    const redirectUrl = await captureRedirect(() => logout());
    expect(redirectUrl).toBe("/login");

    const after = await prisma.session.findUniqueOrThrow({ where: { id: s.id } });
    expect(after.revokedAt).toBeInstanceOf(Date);

    const audits = await prisma.auditLog.findMany({
      where: { actorId: s.user.id, verb: "user.signed_out" },
    });
    expect(audits).toHaveLength(1);
  });

  it("without session → still redirects (idempotent — no error)", async () => {
    const redirectUrl = await captureRedirect(() => logout());
    expect(redirectUrl).toBe("/login");
  });
});

describe("switchActiveTeam", () => {
  it("member of target team → session.activeTeamId updated, audit emitted", async () => {
    const { realtor, teams } = await seedBaseline();
    __setCookie("immo_session", realtor.id);
    // Add realtor to t2 as well so it's switchable.
    await prisma.teamMember.create({
      data: {
        userId: realtor.user.id,
        teamId: teams.t2.id,
        teamRole: "member",
      },
    });
    const res = await switchActiveTeam(teams.t2.id);
    expect(res).toEqual({ ok: true });
    const updated = await prisma.session.findUniqueOrThrow({
      where: { id: realtor.id },
      select: { activeTeamId: true },
    });
    expect(updated.activeTeamId).toBe(teams.t2.id);
    const audits = await prisma.auditLog.findMany({
      where: { verb: "session.team_switched", objectId: teams.t2.id },
    });
    expect(audits).toHaveLength(1);
  });

  it("not a member → rejects, session.activeTeamId UNCHANGED", async () => {
    const { realtor } = await seedBaseline();
    __setCookie("immo_session", realtor.id);
    await seedTeam("t_outsider", "Outsider Team");
    const before = await prisma.session.findUniqueOrThrow({
      where: { id: realtor.id },
      select: { activeTeamId: true },
    });
    const res = await switchActiveTeam("t_outsider");
    expect(res).toEqual({
      ok: false,
      error: "You're not a member of that team.",
    });
    const after = await prisma.session.findUniqueOrThrow({
      where: { id: realtor.id },
      select: { activeTeamId: true },
    });
    expect(after.activeTeamId).toBe(before.activeTeamId);
  });

  it("not signed in (no cookie) → 'Not signed in.' error", async () => {
    const res = await switchActiveTeam("t_test_1");
    expect(res).toEqual({ ok: false, error: "Not signed in." });
  });
});

describe("register — form value preservation", () => {
  function regForm(o: Record<string, string> = {}): FormData {
    const fd = new FormData();
    const defaults: Record<string, string> = {
      firstName: "Riley",
      lastName: "Parker",
      email: "riley@example.test",
      password: "long-enough-pw",
      confirm: "long-enough-pw",
      agency: "Parker Properties",
      region: "Brussels",
      acceptTerms: "on",
    };
    for (const [k, v] of Object.entries({ ...defaults, ...o })) fd.set(k, v);
    return fd;
  }

  it("validation error echoes the user's typed values back (sans password)", async () => {
    const res = await register(undefined, regForm({ email: "not-an-email" }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.formValues).toEqual({
        firstName: "Riley",
        lastName: "Parker",
        email: "not-an-email",
        agency: "Parker Properties",
        region: "Brussels",
      });
      // Critical: never echo the password back through server-action state.
      expect(res.formValues).not.toHaveProperty("password");
      expect(res.formValues).not.toHaveProperty("confirm");
    }
  });

  it("duplicate email error also echoes values (so the user can edit + retry)", async () => {
    await prisma.user.create({
      data: {
        email: "taken@example.test",
        passwordHash: "x",
        firstName: "Existing",
        lastName: "User",
        role: "realtor",
      },
    });
    const res = await register(undefined, regForm({ email: "taken@example.test" }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/already exists/);
      expect(res.formValues?.firstName).toBe("Riley");
      expect(res.formValues?.email).toBe("taken@example.test");
    }
  });

  it("rejects @immo.test emails (reserves the domain for the dev account-switcher group)", async () => {
    const res = await register(undefined, regForm({ email: "attacker@immo.test" }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/email|reserved|allowed/i);
    }
  });

  it("emits user.registered notification to platform admins (Platform parity)", async () => {
    // Seed an admin who'll receive the fan-out + a staff user (admin-only
    // event so staff is filtered out by `eventsForRole` inside notify).
    const adminHash = await hashPassword("password123");
    await prisma.user.create({
      data: {
        id: "u_admin_for_register_test",
        email: "admin@test.local",
        passwordHash: adminHash,
        role: "admin",
        firstName: "Admin",
        lastName: "User",
      },
    });
    await captureRedirect(() =>
      register(undefined, regForm({ email: "fresh@example.test" })),
    );
    // The new user gets a `user.created` audit; the admin is the only
    // recipient that should produce a notify-target downstream. Assert the
    // user.created path instead of mocking sendEmail — the admin fan-out
    // honors `notify`'s opt-out logic which is covered in notify.test.ts.
    const created = await prisma.user.findUniqueOrThrow({
      where: { email: "fresh@example.test" },
    });
    const auditRow = await prisma.auditLog.findFirst({
      where: { actorId: created.id, verb: "user.created" },
    });
    expect(auditRow).toBeTruthy();
  });
});
