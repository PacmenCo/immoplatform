import { describe, expect, it } from "vitest";
import {
  changePasswordInner,
  deleteOwnAccountInner,
  revokeSessionInner,
  signOutEverywhereInner,
} from "@/app/actions/security";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import { seedBaseline } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";

// Platform parity — self-service security:
//   Platform/app/Http/Controllers/Auth/ChangePasswordController.php
//   Platform/app/Http/Controllers/DeleteAccountController.php
//
// Covers:
//   1. changePassword — current-password verify, zod policy, new-session
//      revoke-other-sessions, audit
//   2. deleteOwnAccount — password confirm, last-admin guard, soft-delete,
//      session-wipe, audit
//   3. revokeSession — owner-only, idempotent
//   4. signOutEverywhere — preserves caller's session, count returned

setupTestDb();

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

/** Build a session + set a known password on the user so we can verify
 *  current-password gates in changePassword / deleteOwnAccount. */
async function sessionWithPassword(opts: {
  role?: "admin" | "staff" | "realtor" | "freelancer";
  userId?: string;
  password: string;
}) {
  const session = await makeSession({
    role: opts.role ?? "realtor",
    userId: opts.userId ?? `u_sec_${Math.random().toString(36).slice(2, 8)}`,
  });
  const hash = await hashPassword(opts.password);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: hash },
  });
  return session;
}

describe("changePasswordInner — happy path", () => {
  it("correct current password + valid new → hash rotated, other sessions revoked, audit", async () => {
    const session = await sessionWithPassword({
      userId: "u_pw_happy",
      password: "old-password-1",
    });
    // Seed a second session to prove it gets revoked.
    const other = await prisma.session.create({
      data: {
        id: "s_other_session",
        userId: session.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const res = await changePasswordInner(
      session,
      undefined,
      form({
        currentPassword: "old-password-1",
        newPassword: "new-password-9",
        confirmPassword: "new-password-9",
      }),
    );
    expect(res).toEqual({ ok: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    expect(user.passwordHash).not.toBeNull();
    expect(await verifyPassword("new-password-9", user.passwordHash!)).toBe(true);

    const otherAfter = await prisma.session.findUniqueOrThrow({ where: { id: other.id } });
    expect(otherAfter.revokedAt).toBeInstanceOf(Date);

    // Current session should NOT be revoked.
    const current = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(current.revokedAt).toBeNull();

    const audits = await prisma.auditLog.findMany({
      where: { actorId: session.user.id },
      select: { verb: true, metadata: true },
    });
    const verbs = audits.map((a) => a.verb);
    expect(verbs).toContain("user.password_changed");
    expect(verbs).toContain("user.sessions_revoked");
  });

  it("no other sessions → no sessions_revoked audit emitted", async () => {
    const session = await sessionWithPassword({
      userId: "u_pw_only_session",
      password: "old-password-1",
    });
    await changePasswordInner(
      session,
      undefined,
      form({
        currentPassword: "old-password-1",
        newPassword: "new-password-9",
        confirmPassword: "new-password-9",
      }),
    );
    const audits = await prisma.auditLog.findMany({
      where: { actorId: session.user.id, verb: "user.sessions_revoked" },
    });
    expect(audits).toHaveLength(0);
  });
});

describe("changePasswordInner — guard clauses", () => {
  it("wrong current password → 'incorrect' error, hash UNCHANGED", async () => {
    const session = await sessionWithPassword({
      userId: "u_pw_wrong",
      password: "the-real-password",
    });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    const res = await changePasswordInner(
      session,
      undefined,
      form({
        currentPassword: "a-guess",
        newPassword: "new-password-9",
        confirmPassword: "new-password-9",
      }),
    );
    expect(res).toEqual({ ok: false, error: "Current password is incorrect." });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it("new password too short → zod rejects (≥8 chars)", async () => {
    const session = await sessionWithPassword({
      userId: "u_pw_short",
      password: "old-password-1",
    });
    const res = await changePasswordInner(
      session,
      undefined,
      form({
        currentPassword: "old-password-1",
        newPassword: "short",
        confirmPassword: "short",
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/at least 8/);
  });

  it("new password missing digit → zod rejects (policy requires letters + numbers)", async () => {
    const session = await sessionWithPassword({
      userId: "u_pw_no_digit",
      password: "old-password-1",
    });
    const res = await changePasswordInner(
      session,
      undefined,
      form({
        currentPassword: "old-password-1",
        newPassword: "letters-only-pass",
        confirmPassword: "letters-only-pass",
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/number/i);
  });

  it("confirm mismatch → specific error", async () => {
    const session = await sessionWithPassword({
      userId: "u_pw_confirm_mismatch",
      password: "old-password-1",
    });
    const res = await changePasswordInner(
      session,
      undefined,
      form({
        currentPassword: "old-password-1",
        newPassword: "new-password-9",
        confirmPassword: "new-password-8",
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/don't match/);
  });

  it("new === current password → rejects (defense against no-op flips)", async () => {
    const session = await sessionWithPassword({
      userId: "u_pw_no_change",
      password: "identical-pass-9",
    });
    const res = await changePasswordInner(
      session,
      undefined,
      form({
        currentPassword: "identical-pass-9",
        newPassword: "identical-pass-9",
        confirmPassword: "identical-pass-9",
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/different/);
  });

  it("account with no password hash → rejects with forgot-password hint", async () => {
    await seedBaseline();
    const session = await makeSession({
      role: "realtor",
      userId: "u_no_hash",
    });
    const res = await changePasswordInner(
      session,
      undefined,
      form({
        currentPassword: "anything",
        newPassword: "new-password-9",
        confirmPassword: "new-password-9",
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/forgot-password/);
  });
});

describe("deleteOwnAccountInner", () => {
  it("correct password → soft-deletes user + revokes all sessions + audit", async () => {
    const session = await sessionWithPassword({
      userId: "u_delete_happy",
      password: "my-password-1",
      role: "realtor",
    });
    // Second session — must also be revoked.
    const other = await prisma.session.create({
      data: {
        id: "s_other_delete",
        userId: session.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const res = await deleteOwnAccountInner(
      session,
      undefined,
      form({ password: "my-password-1" }),
    );
    expect(res).toEqual({ ok: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    expect(user.deletedAt).toBeInstanceOf(Date);

    const currentAfter = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    const otherAfter = await prisma.session.findUniqueOrThrow({ where: { id: other.id } });
    expect(currentAfter.revokedAt).toBeInstanceOf(Date);
    expect(otherAfter.revokedAt).toBeInstanceOf(Date);

    const audits = await prisma.auditLog.findMany({
      where: { actorId: session.user.id, verb: "user.deleted" },
      select: { metadata: true },
    });
    expect(audits).toHaveLength(1);
    expect(auditMeta(audits[0].metadata).via).toBe("self_service");
  });

  it("wrong password → rejected, user NOT soft-deleted", async () => {
    const session = await sessionWithPassword({
      userId: "u_delete_wrong_pw",
      password: "correct",
    });
    const res = await deleteOwnAccountInner(
      session,
      undefined,
      form({ password: "guess" }),
    );
    expect(res).toEqual({ ok: false, error: "Password is incorrect." });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    expect(user.deletedAt).toBeNull();
  });

  it("missing password-hash account → rejects cleanly", async () => {
    const session = await makeSession({
      role: "realtor",
      userId: "u_delete_no_hash",
    });
    const res = await deleteOwnAccountInner(
      session,
      undefined,
      form({ password: "anything" }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no password set/);
  });

  it("last admin → BLOCKED (prevents zero-admin lockout)", async () => {
    // Make a fresh admin session; no other admins in the DB.
    const session = await sessionWithPassword({
      role: "admin",
      userId: "u_last_admin",
      password: "admin-pass-1",
    });
    const res = await deleteOwnAccountInner(
      session,
      undefined,
      form({ password: "admin-pass-1" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "You are the last admin. Promote another user before deleting your account.",
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    expect(user.deletedAt).toBeNull();
  });

  it("not-the-last admin (there's another) → delete allowed", async () => {
    // Seed a second admin who sticks around.
    await prisma.user.create({
      data: {
        id: "u_other_admin",
        email: "other-admin@test.local",
        role: "admin",
        firstName: "Other",
        lastName: "Admin",
      },
    });
    const session = await sessionWithPassword({
      role: "admin",
      userId: "u_retiring_admin",
      password: "admin-pass-1",
    });
    const res = await deleteOwnAccountInner(
      session,
      undefined,
      form({ password: "admin-pass-1" }),
    );
    expect(res).toEqual({ ok: true });
  });

  it("soft-deleted OTHER admins don't count toward the last-admin guard", async () => {
    // One other admin, but soft-deleted — effectively our user IS the last.
    await prisma.user.create({
      data: {
        id: "u_zombie_admin",
        email: "zombie@test.local",
        role: "admin",
        firstName: "Ghost",
        lastName: "Admin",
        deletedAt: new Date(),
      },
    });
    const session = await sessionWithPassword({
      role: "admin",
      userId: "u_last_effective_admin",
      password: "admin-pass-1",
    });
    const res = await deleteOwnAccountInner(
      session,
      undefined,
      form({ password: "admin-pass-1" }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("revokeSessionInner", () => {
  it("owner revokes their own session → revokedAt stamped + audit", async () => {
    const session = await makeSession({ role: "realtor", userId: "u_revoke_owner" });
    const target = await prisma.session.create({
      data: {
        id: "s_target_revoke",
        userId: session.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const res = await revokeSessionInner(session, target.id);
    expect(res).toEqual({ ok: true });
    const after = await prisma.session.findUniqueOrThrow({ where: { id: target.id } });
    expect(after.revokedAt).toBeInstanceOf(Date);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: session.user.id, verb: "user.sessions_revoked" },
      select: { metadata: true },
    });
    const meta = auditMeta(audit.metadata);
    expect(meta.via).toBe("revoke_one");
    expect(meta.count).toBe(1);
  });

  it("revoking ANOTHER user's session → 'Session not found.' (no cross-user reach)", async () => {
    const me = await makeSession({ role: "realtor", userId: "u_alice_revoker" });
    const them = await makeSession({ role: "realtor", userId: "u_bob_victim" });
    const res = await revokeSessionInner(me, them.id);
    expect(res).toEqual({ ok: false, error: "Session not found." });
    const theirs = await prisma.session.findUniqueOrThrow({ where: { id: them.id } });
    expect(theirs.revokedAt).toBeNull();
  });

  it("non-existent session id → 'Session not found.'", async () => {
    const me = await makeSession({ role: "realtor", userId: "u_ghost_hunter" });
    const res = await revokeSessionInner(me, "s_does_not_exist");
    expect(res).toEqual({ ok: false, error: "Session not found." });
  });

  it("already-revoked session → ok (idempotent)", async () => {
    const me = await makeSession({ role: "realtor", userId: "u_double_revoke" });
    const target = await prisma.session.create({
      data: {
        id: "s_already_revoked",
        userId: me.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: new Date(),
      },
    });
    const res = await revokeSessionInner(me, target.id);
    expect(res).toEqual({ ok: true });
  });

  it("empty string session id → 'Invalid session id.'", async () => {
    const me = await makeSession({ role: "realtor", userId: "u_empty_id" });
    const res = await revokeSessionInner(me, "");
    expect(res).toEqual({ ok: false, error: "Invalid session id." });
  });
});

describe("signOutEverywhereInner", () => {
  it("revokes every other active session, KEEPS caller's current one", async () => {
    const session = await makeSession({ role: "realtor", userId: "u_sign_out_all" });
    // Seed 2 more sessions for this user.
    await prisma.session.create({
      data: {
        id: "s_other_1",
        userId: session.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await prisma.session.create({
      data: {
        id: "s_other_2",
        userId: session.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const res = await signOutEverywhereInner(session);
    expect(res).toEqual({ ok: true, data: { count: 2 } });
    const remaining = await prisma.session.findMany({
      where: { userId: session.user.id, revokedAt: null },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(session.id);
  });

  it("no other sessions → count=0, no audit emitted", async () => {
    const session = await makeSession({ role: "realtor", userId: "u_alone_session" });
    const res = await signOutEverywhereInner(session);
    expect(res).toEqual({ ok: true, data: { count: 0 } });
    const audits = await prisma.auditLog.count({
      where: { actorId: session.user.id, verb: "user.sessions_revoked" },
    });
    expect(audits).toBe(0);
  });

  it("already-revoked sessions don't inflate the count", async () => {
    const session = await makeSession({ role: "realtor", userId: "u_half_revoked" });
    await prisma.session.create({
      data: {
        id: "s_already_out",
        userId: session.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: new Date(),
      },
    });
    await prisma.session.create({
      data: {
        id: "s_still_active",
        userId: session.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const res = await signOutEverywhereInner(session);
    // Only 1 active-other-session exists; count should be 1, not 2.
    expect(res).toEqual({ ok: true, data: { count: 1 } });
  });
});
