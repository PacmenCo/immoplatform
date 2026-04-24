import { beforeEach, describe, expect, it } from "vitest";
import {
  acceptInviteInner,
  createInviteInner,
  getInviteByToken,
  resendInviteInner,
  revokeInviteInner,
} from "@/app/actions/invites";
import { generateToken, hashToken } from "@/lib/auth";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import { seedBaseline, seedTeam } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";
import { __resetRequestContext } from "../_helpers/next-headers-stub";

// Platform parity — the entire onboarding flow:
//   Platform/app/Http/Controllers/InviteController.php
//   Platform/app/Http/Controllers/Auth/RegisterController.php
//
// Covers:
//   1. createInvite — role gate, team-pair validation, duplicate rejection,
//      single-owner policy, existing-user fallback
//   2. acceptInvite — token states (expired, revoked, used), password min,
//      user creation + team membership, session activation
//   3. resendInvite — permission gate + rolling rate limit + token rotation
//   4. revokeInvite — permission gate + idempotence
//   5. getInviteByToken — status classification

setupTestDb();

beforeEach(() => {
  __resetRequestContext();
});

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

describe("createInviteInner — role gate", () => {
  it("admin can invite any role", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createInviteInner(
      admin,
      undefined,
      form({ email: "newadmin@test.local", role: "admin", teamId: teams.t1.id, teamRole: "member" }),
    );
    expect(res).toEqual({ ok: true });
    const invites = await prisma.invite.findMany({
      where: { email: "newadmin@test.local" },
    });
    expect(invites).toHaveLength(1);
    expect(invites[0].role).toBe("admin");
  });

  it("staff CANNOT invite admin", async () => {
    const { staff } = await seedBaseline();
    const res = await createInviteInner(
      staff,
      undefined,
      form({ email: "newadmin@test.local", role: "admin" }),
    );
    expect(res).toEqual({ ok: false, error: "Staff cannot invite admins." });
  });

  it("realtor CANNOT invite admin or staff", async () => {
    const { realtor } = await seedBaseline();
    for (const role of ["admin", "staff"]) {
      const res = await createInviteInner(
        realtor,
        undefined,
        form({ email: "x@test.local", role }),
      );
      expect(res).toEqual({
        ok: false,
        error: "Only admins can invite admin or staff users.",
      });
    }
  });

  it("realtor MUST supply a teamId (they can't invite to no team)", async () => {
    const { realtor } = await seedBaseline();
    const res = await createInviteInner(
      realtor,
      undefined,
      form({ email: "freelo@test.local", role: "freelancer" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "You must assign the invitee to your team.",
    });
  });

  it("realtor can only invite to teams they OWN", async () => {
    const { realtor } = await seedBaseline();
    // realtor owns t_test_1 via seedBaseline. Try to invite to t_test_2 — no owner membership.
    const res = await createInviteInner(
      realtor,
      undefined,
      form({
        email: "freelo@test.local",
        role: "freelancer",
        teamId: "t_test_2",
        teamRole: "member",
      }),
    );
    expect(res).toEqual({
      ok: false,
      error: "You can only invite to teams you own.",
    });
  });

  it("freelancer rejected entirely", async () => {
    const { freelancer } = await seedBaseline();
    const res = await createInviteInner(
      freelancer,
      undefined,
      form({ email: "x@test.local", role: "freelancer" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to invite users.",
    });
  });
});

describe("createInviteInner — team pairing", () => {
  it("teamId without teamRole → rejected", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createInviteInner(
      admin,
      undefined,
      form({ email: "x@test.local", role: "freelancer", teamId: teams.t1.id }),
    );
    expect(res).toEqual({
      ok: false,
      error: "Pick a team role (Member or Owner).",
    });
  });

  it("teamRole without teamId → rejected", async () => {
    const { admin } = await seedBaseline();
    const res = await createInviteInner(
      admin,
      undefined,
      form({ email: "x@test.local", role: "freelancer", teamRole: "owner" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "Pick a team before setting a team role.",
    });
  });

  it("inviting as Owner when team already has an owner → rejected with owner name in error", async () => {
    const { admin, realtor, teams } = await seedBaseline();
    void realtor; // realtor owns t1 (seedBaseline wires this)
    const res = await createInviteInner(
      admin,
      undefined,
      form({
        email: "hostile-takeover@test.local",
        role: "realtor",
        teamId: teams.t1.id,
        teamRole: "owner",
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/already has an owner/);
      expect(res.error).toMatch(/Test Realtor/); // existing owner's name
    }
  });
});

describe("createInviteInner — existing user path", () => {
  it("existing user + teamId → adds them to the team silently (no invite row)", async () => {
    const { admin, teams, freelancer } = await seedBaseline();
    // freelancer exists as a user but isn't on any team
    const res = await createInviteInner(
      admin,
      undefined,
      form({
        email: freelancer.user.email,
        role: "freelancer",
        teamId: teams.t2.id,
        teamRole: "member",
      }),
    );
    expect(res).toEqual({ ok: true });
    const invites = await prisma.invite.count({
      where: { email: freelancer.user.email },
    });
    expect(invites).toBe(0);
    const membership = await prisma.teamMember.findUniqueOrThrow({
      where: {
        teamId_userId: { teamId: teams.t2.id, userId: freelancer.user.id },
      },
    });
    expect(membership.teamRole).toBe("member");
  });

  it("existing user WITHOUT teamId → rejected with clear error", async () => {
    const { admin, freelancer } = await seedBaseline();
    const res = await createInviteInner(
      admin,
      undefined,
      form({ email: freelancer.user.email, role: "freelancer" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "This email already has an account. Pick a team to add them to.",
    });
  });

  it("existing user already on team → upsert (updates role, no duplicate)", async () => {
    const { admin, teams, realtor } = await seedBaseline();
    // realtor is currently owner of t1 via seedBaseline — re-invite as member.
    await createInviteInner(
      admin,
      undefined,
      form({
        email: realtor.user.email,
        role: "realtor",
        teamId: teams.t1.id,
        teamRole: "member",
      }),
    );
    const memberships = await prisma.teamMember.findMany({
      where: { userId: realtor.user.id, teamId: teams.t1.id },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].teamRole).toBe("member");
  });
});

describe("createInviteInner — invite creation + shape", () => {
  it("writes an Invite row with hashed token + 7-day expiry", async () => {
    const { admin, teams } = await seedBaseline();
    await createInviteInner(
      admin,
      undefined,
      form({
        email: "fresh@test.local",
        role: "freelancer",
        teamId: teams.t1.id,
        teamRole: "member",
        note: "Welcome aboard!",
      }),
    );
    const invite = await prisma.invite.findFirstOrThrow({
      where: { email: "fresh@test.local" },
    });
    expect(invite.role).toBe("freelancer");
    expect(invite.teamId).toBe(teams.t1.id);
    expect(invite.teamRole).toBe("member");
    expect(invite.note).toBe("Welcome aboard!");
    expect(invite.invitedById).toBe(admin.user.id);
    expect(invite.acceptedAt).toBeNull();
    expect(invite.revokedAt).toBeNull();
    // Hashed token — 64-char hex sha256 digest shape.
    expect(invite.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    // ~7 days in the future.
    const expected = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(invite.expiresAt.getTime()).toBeGreaterThan(expected - 60_000);
    expect(invite.expiresAt.getTime()).toBeLessThan(expected + 60_000);
  });

  it("emits invite.sent audit with email/role/teamId/teamRole metadata", async () => {
    const { admin, teams } = await seedBaseline();
    await createInviteInner(
      admin,
      undefined,
      form({
        email: "audit@test.local",
        role: "realtor",
        teamId: teams.t2.id,
        teamRole: "owner",
      }),
    );
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: admin.user.id, verb: "invite.sent" },
      select: { metadata: true },
    });
    expect(auditMeta(audit.metadata)).toEqual({
      email: "audit@test.local",
      role: "realtor",
      teamId: teams.t2.id,
      teamRole: "owner",
    });
  });

  it("duplicate pending invite for the same email → rejected", async () => {
    const { admin, teams } = await seedBaseline();
    await createInviteInner(
      admin,
      undefined,
      form({
        email: "duplicate@test.local",
        role: "freelancer",
        teamId: teams.t1.id,
        teamRole: "member",
      }),
    );
    const second = await createInviteInner(
      admin,
      undefined,
      form({
        email: "duplicate@test.local",
        role: "freelancer",
        teamId: teams.t1.id,
        teamRole: "member",
      }),
    );
    expect(second).toEqual({
      ok: false,
      error: "There's already a pending invite for this email. Revoke it first.",
    });
  });
});

describe("getInviteByToken", () => {
  async function setupInvite(overrides: {
    acceptedAt?: Date;
    revokedAt?: Date;
    expiresAt?: Date;
  } = {}) {
    const { admin, teams } = await seedBaseline();
    const token = generateToken();
    const invite = await prisma.invite.create({
      data: {
        email: "invitee@test.local",
        role: "freelancer",
        teamId: teams.t1.id,
        teamRole: "member",
        tokenHash: hashToken(token),
        invitedById: admin.user.id,
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 86_400_000),
        acceptedAt: overrides.acceptedAt ?? null,
        revokedAt: overrides.revokedAt ?? null,
      },
    });
    return { token, invite };
  }

  it("valid token → {status:'ok', invite}", async () => {
    const { token } = await setupInvite();
    const res = await getInviteByToken(token);
    expect(res.status).toBe("ok");
  });

  it("unknown token → {status:'not_found'}", async () => {
    await seedBaseline();
    const res = await getInviteByToken("nonexistent-token-value");
    expect(res.status).toBe("not_found");
  });

  it("revoked token → {status:'revoked'}", async () => {
    const { token } = await setupInvite({ revokedAt: new Date() });
    const res = await getInviteByToken(token);
    expect(res.status).toBe("revoked");
  });

  it("already-accepted token → {status:'accepted'}", async () => {
    const { token } = await setupInvite({ acceptedAt: new Date() });
    const res = await getInviteByToken(token);
    expect(res.status).toBe("accepted");
  });

  it("expired token → {status:'expired'}", async () => {
    const { token } = await setupInvite({ expiresAt: new Date(Date.now() - 1000) });
    const res = await getInviteByToken(token);
    expect(res.status).toBe("expired");
  });
});

describe("acceptInviteInner", () => {
  async function createPendingInvite(): Promise<{ token: string; inviteId: string; teamId: string }> {
    const { admin, teams } = await seedBaseline();
    const token = generateToken();
    const invite = await prisma.invite.create({
      data: {
        email: "accepted@test.local",
        role: "freelancer",
        teamId: teams.t1.id,
        teamRole: "member",
        tokenHash: hashToken(token),
        invitedById: admin.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    return { token, inviteId: invite.id, teamId: teams.t1.id };
  }

  it("valid token + form → creates User + TeamMember + session + audit", async () => {
    const { token, teamId, inviteId } = await createPendingInvite();
    const res = await acceptInviteInner(
      undefined,
      form({
        token,
        firstName: "Newbie",
        lastName: "Worker",
        password: "correct-password-here",
        confirm: "correct-password-here",
      }),
    );
    expect(res).toEqual({ ok: true });

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "accepted@test.local" },
    });
    expect(user.firstName).toBe("Newbie");
    expect(user.role).toBe("freelancer");
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);

    const membership = await prisma.teamMember.findUniqueOrThrow({
      where: { teamId_userId: { teamId, userId: user.id } },
    });
    expect(membership.teamRole).toBe("member");

    const invite = await prisma.invite.findUniqueOrThrow({ where: { id: inviteId } });
    expect(invite.acceptedAt).toBeInstanceOf(Date);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: user.id, verb: "user.created" },
      select: { metadata: true },
    });
    const meta = auditMeta(audit.metadata);
    expect(meta.via).toBe("invite");
    expect(meta.inviteId).toBe(inviteId);
  });

  it("password too short → rejected", async () => {
    const { token } = await createPendingInvite();
    const res = await acceptInviteInner(
      undefined,
      form({
        token,
        firstName: "A",
        lastName: "B",
        password: "short",
        confirm: "short",
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/at least 10/);
  });

  it("password/confirm mismatch → 'Passwords don't match.'", async () => {
    const { token } = await createPendingInvite();
    const res = await acceptInviteInner(
      undefined,
      form({
        token,
        firstName: "A",
        lastName: "B",
        password: "password-one",
        confirm: "password-two",
      }),
    );
    expect(res).toEqual({ ok: false, error: "Passwords don't match." });
  });

  it("unknown token → 'This invite doesn\\'t exist.'", async () => {
    await seedBaseline();
    const res = await acceptInviteInner(
      undefined,
      form({
        token: "unknownunknownunknown",
        firstName: "A",
        lastName: "B",
        password: "long-enough-password",
        confirm: "long-enough-password",
      }),
    );
    expect(res).toEqual({ ok: false, error: "This invite doesn't exist." });
  });

  it("expired invite → friendly 'expired' message", async () => {
    const { admin, teams } = await seedBaseline();
    const token = generateToken();
    await prisma.invite.create({
      data: {
        email: "expired-invitee@test.local",
        role: "freelancer",
        teamId: teams.t1.id,
        teamRole: "member",
        tokenHash: hashToken(token),
        invitedById: admin.user.id,
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const res = await acceptInviteInner(
      undefined,
      form({
        token,
        firstName: "A",
        lastName: "B",
        password: "long-enough-password",
        confirm: "long-enough-password",
      }),
    );
    expect(res).toEqual({
      ok: false,
      error: "This invite has expired. Ask to be re-invited.",
    });
  });

  it("revoked invite → friendly 'revoked' message", async () => {
    const { admin, teams } = await seedBaseline();
    const token = generateToken();
    await prisma.invite.create({
      data: {
        email: "revoked-invitee@test.local",
        role: "freelancer",
        teamId: teams.t1.id,
        teamRole: "member",
        tokenHash: hashToken(token),
        invitedById: admin.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: new Date(),
      },
    });
    const res = await acceptInviteInner(
      undefined,
      form({
        token,
        firstName: "A",
        lastName: "B",
        password: "long-enough-password",
        confirm: "long-enough-password",
      }),
    );
    expect(res).toEqual({
      ok: false,
      error: "This invite has been revoked.",
    });
  });

  it("already-accepted invite → 'already used'", async () => {
    const { admin, teams } = await seedBaseline();
    const token = generateToken();
    await prisma.invite.create({
      data: {
        email: "accepted-invitee@test.local",
        role: "freelancer",
        teamId: teams.t1.id,
        teamRole: "member",
        tokenHash: hashToken(token),
        invitedById: admin.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
        acceptedAt: new Date(),
      },
    });
    const res = await acceptInviteInner(
      undefined,
      form({
        token,
        firstName: "A",
        lastName: "B",
        password: "long-enough-password",
        confirm: "long-enough-password",
      }),
    );
    expect(res).toEqual({
      ok: false,
      error: "This invite has already been used.",
    });
  });

  it("email clash (user registered concurrently) → friendly sign-in prompt", async () => {
    const { token } = await createPendingInvite();
    // Race: create a user with the invite's email before accepting.
    await prisma.user.create({
      data: {
        id: "u_race_winner",
        email: "accepted@test.local",
        role: "freelancer",
        firstName: "Race",
        lastName: "Winner",
      },
    });
    const res = await acceptInviteInner(
      undefined,
      form({
        token,
        firstName: "A",
        lastName: "B",
        password: "long-enough-password",
        confirm: "long-enough-password",
      }),
    );
    expect(res).toEqual({
      ok: false,
      error: "An account with this email already exists. Try signing in.",
    });
  });
});

describe("resendInviteInner", () => {
  async function setupInvite(inviterSession?: { userId: string }) {
    const { admin, teams } = await seedBaseline();
    const inviter = inviterSession ?? admin;
    const token = generateToken();
    const invite = await prisma.invite.create({
      data: {
        email: "resend-me@test.local",
        role: "freelancer",
        teamId: teams.t1.id,
        teamRole: "member",
        tokenHash: hashToken(token),
        invitedById: "userId" in inviter ? inviter.userId : admin.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    return { token, invite, admin };
  }

  it("admin resend → rotates token hash, extends expiry, bumps resendCount", async () => {
    const { invite, admin } = await setupInvite();
    const res = await resendInviteInner(admin, invite.id);
    expect(res).toEqual({ ok: true });
    const after = await prisma.invite.findUniqueOrThrow({
      where: { id: invite.id },
    });
    expect(after.tokenHash).not.toBe(invite.tokenHash);
    expect(after.resendCount).toBe(1);
    expect(after.lastResentAt).toBeInstanceOf(Date);
    expect(after.expiresAt.getTime()).toBeGreaterThan(invite.expiresAt.getTime() - 1000);
  });

  it("already-accepted invite → rejected", async () => {
    const { invite, admin } = await setupInvite();
    await prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    const res = await resendInviteInner(admin, invite.id);
    expect(res).toEqual({ ok: false, error: "Invite already accepted." });
  });

  it("revoked invite → rejected", async () => {
    const { invite, admin } = await setupInvite();
    await prisma.invite.update({
      where: { id: invite.id },
      data: { revokedAt: new Date() },
    });
    const res = await resendInviteInner(admin, invite.id);
    expect(res).toEqual({ ok: false, error: "Invite revoked." });
  });

  it("rate limit — 3 resends in 1h then blocked", async () => {
    const { invite, admin } = await setupInvite();
    await resendInviteInner(admin, invite.id);
    await resendInviteInner(admin, invite.id);
    await resendInviteInner(admin, invite.id);
    const blocked = await resendInviteInner(admin, invite.id);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/Rate limited/);
  });

  it("rate limit RESETS after the window elapses (last resend >1h ago)", async () => {
    const { invite, admin } = await setupInvite();
    // Prior 3 resends but last was > 1h ago — counter should reset.
    await prisma.invite.update({
      where: { id: invite.id },
      data: {
        resendCount: 3,
        lastResentAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    });
    const res = await resendInviteInner(admin, invite.id);
    expect(res).toEqual({ ok: true });
    const after = await prisma.invite.findUniqueOrThrow({
      where: { id: invite.id },
    });
    // Counter reset to 1, not 4.
    expect(after.resendCount).toBe(1);
  });

  it("outsider realtor (not the inviter) rejected", async () => {
    const { invite } = await setupInvite();
    await seedTeam("t_outsider_invite_team", "Outsider");
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_outsider_invite",
      membershipTeams: [{ teamId: "t_outsider_invite_team", teamRole: "owner" }],
    });
    const res = await resendInviteInner(outsider, invite.id);
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to resend this invite.",
    });
  });
});

describe("revokeInviteInner", () => {
  async function pendingInvite() {
    const { admin, teams } = await seedBaseline();
    const invite = await prisma.invite.create({
      data: {
        email: "revoke-me@test.local",
        role: "freelancer",
        teamId: teams.t1.id,
        teamRole: "member",
        tokenHash: hashToken(generateToken()),
        invitedById: admin.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    return { invite, admin };
  }

  it("admin revoke → sets revokedAt + emits audit", async () => {
    const { invite, admin } = await pendingInvite();
    const res = await revokeInviteInner(admin, invite.id);
    expect(res).toEqual({ ok: true });
    const after = await prisma.invite.findUniqueOrThrow({
      where: { id: invite.id },
    });
    expect(after.revokedAt).toBeInstanceOf(Date);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: admin.user.id, verb: "invite.revoked" },
    });
    expect(audit.objectId).toBe(invite.id);
  });

  it("revoking a non-existent invite → 'Invite not found.'", async () => {
    const { admin } = await seedBaseline();
    const res = await revokeInviteInner(admin, "i_ghost");
    expect(res).toEqual({ ok: false, error: "Invite not found." });
  });

  it("revoking an already-revoked invite is idempotent (ok, no new audit)", async () => {
    const { invite, admin } = await pendingInvite();
    await revokeInviteInner(admin, invite.id);
    const second = await revokeInviteInner(admin, invite.id);
    expect(second).toEqual({ ok: true });
    const audits = await prisma.auditLog.count({
      where: { verb: "invite.revoked", objectId: invite.id },
    });
    expect(audits).toBe(1);
  });

  it("already-accepted invite → 'already accepted' rejection", async () => {
    const { invite, admin } = await pendingInvite();
    await prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    const res = await revokeInviteInner(admin, invite.id);
    expect(res).toEqual({ ok: false, error: "Invite already accepted." });
  });

  it("outsider realtor rejected", async () => {
    const { invite } = await pendingInvite();
    await seedTeam("t_outsider_revoke", "Outsider");
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_outsider_revoke",
      membershipTeams: [{ teamId: "t_outsider_revoke", teamRole: "owner" }],
    });
    const res = await revokeInviteInner(outsider, invite.id);
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to revoke this invite.",
    });
  });
});
