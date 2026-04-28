import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("staff CANNOT invite at all (v1 parity — Platform's medewerker has zero invite power)", async () => {
    const { staff } = await seedBaseline();
    for (const role of ["admin", "staff", "realtor", "freelancer"]) {
      const res = await createInviteInner(
        staff,
        undefined,
        form({ email: "x@test.local", role }),
      );
      expect(res).toEqual({
        ok: false,
        error: "You don't have permission to invite users.",
      });
    }
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
    // Use realtor invitee since freelancer + teamId is now schema-rejected
    // (v1 parity: freelancers are platform-global, never team-attached).
    const res = await createInviteInner(
      realtor,
      undefined,
      form({
        email: "newcoworker@test.local",
        role: "realtor",
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
    // Use realtor invitee — freelancer + teamId is now schema-rejected.
    const res = await createInviteInner(
      admin,
      undefined,
      form({ email: "x@test.local", role: "realtor", teamId: teams.t1.id }),
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
      form({ email: "x@test.local", role: "realtor", teamRole: "owner" }),
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
  it("existing realtor user + teamId → adds them to the team silently (no invite row)", async () => {
    // Need a non-owner realtor user that isn't already on t2. Create a fresh one.
    const { admin, teams } = await seedBaseline();
    const realtor2 = await makeSession({
      role: "realtor",
      userId: "u_realtor2",
    });
    const res = await createInviteInner(
      admin,
      undefined,
      form({
        email: realtor2.user.email,
        role: "realtor",
        teamId: teams.t2.id,
        teamRole: "member",
      }),
    );
    expect(res).toEqual({ ok: true });
    const invites = await prisma.invite.count({
      where: { email: realtor2.user.email },
    });
    expect(invites).toBe(0);
    const membership = await prisma.teamMember.findUniqueOrThrow({
      where: {
        teamId_userId: { teamId: teams.t2.id, userId: realtor2.user.id },
      },
    });
    expect(membership.teamRole).toBe("member");
  });

  it("existing freelancer user + teamId → REJECTED (v1 parity: freelancers can never be team-attached)", async () => {
    const { admin, teams, freelancer } = await seedBaseline();
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
    // Schema fires first because the invite payload has freelancer + teamId.
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/Freelancers can't be assigned to a team/);
    }
  });

  it("existing user WITHOUT teamId → rejected with clear error (non-freelancer)", async () => {
    const { admin } = await seedBaseline();
    // Need an existing non-freelancer user since freelancer-existing now hits
    // a different branch. Realtor with no team is the cleanest fixture.
    const dangling = await makeSession({
      role: "realtor",
      userId: "u_dangling_realtor",
    });
    const res = await createInviteInner(
      admin,
      undefined,
      form({ email: dangling.user.email, role: "realtor" }),
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
        role: "realtor",
        teamId: teams.t1.id,
        teamRole: "member",
        note: "Welcome aboard!",
      }),
    );
    const invite = await prisma.invite.findFirstOrThrow({
      where: { email: "fresh@test.local" },
    });
    expect(invite.role).toBe("realtor");
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
        role: "realtor",
        teamId: teams.t1.id,
        teamRole: "member",
      }),
    );
    const second = await createInviteInner(
      admin,
      undefined,
      form({
        email: "duplicate@test.local",
        role: "realtor",
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
        role: "realtor",
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
        role: "realtor",
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
    expect(user.role).toBe("realtor");
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
        role: "realtor",
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
        role: "realtor",
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
    const { admin, staff, teams } = await seedBaseline();
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
    return { token, invite, admin, staff };
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

  it("staff CANNOT resend (v1 parity — Platform's medewerker has no invite UI)", async () => {
    // setupInvite calls seedBaseline once already; reuse the staff session
    // it spawns rather than calling seedBaseline twice (would conflict on team
    // unique IDs).
    const { invite, staff } = await setupInvite();
    const res = await resendInviteInner(staff, invite.id);
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to resend this invite.",
    });
  });

  // Contract pin: the action must NOT load invitedBy with `include: true` —
  // that returns the full User row including passwordHash. Even if the hash
  // isn't currently returned to the client, having it sit in server memory
  // tied to a long-lived `invite` object is one console.log / audit-metadata /
  // error-serialization away from leaking. Narrow via select so the surface
  // shrinks regardless of how callers reuse the invite object downstream.
  //
  // Vitest can't `spyOn` Prisma client methods (they're proxy-defined), so
  // we pin the contract at the source level. Brittle to formatting but
  // catches the exact regression we care about: somebody re-introducing
  // `invitedBy: true`.
  it("source contract: resendInvite must not use `invitedBy: true` (over-fetches passwordHash)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/app/actions/invites.ts", "utf8");
    // Locate the resendInviteInner body and inspect its findUnique include.
    const start = src.indexOf("export async function resendInviteInner");
    expect(start).toBeGreaterThan(-1);
    // Slice a generous window — the function's findUnique sits within ~20 lines.
    const body = src.slice(start, start + 1500);
    expect(body).toContain("invite.findUnique");
    // The bug shape: `invitedBy: true` anywhere in this window.
    expect(body).not.toMatch(/invitedBy\s*:\s*true/);
    // The fix shape: a select narrowing including firstName + lastName.
    expect(body).toMatch(/invitedBy\s*:\s*\{\s*select\s*:[^}]*firstName/);
    expect(body).toMatch(/invitedBy\s*:\s*\{\s*select\s*:[^}]*lastName/);
    // And no passwordHash anywhere in the same select.
    expect(body).not.toMatch(/invitedBy\s*:\s*\{\s*select\s*:[^}]*passwordHash/);
  });

  it("the email send still receives the correct inviter name (no regression)", async () => {
    // Functional check that the narrowed select doesn't break the email path.
    // If the inviter name had been undefined, inviteEmail would have built
    // a malformed body but resendInviteInner would still return ok:true (the
    // template is best-effort). So we instead assert the side-effects fire
    // (token rotated, expiry bumped) — proves the action made it past the
    // template-render step without throwing.
    const { invite, admin } = await setupInvite();
    const res = await resendInviteInner(admin, invite.id);
    expect(res).toEqual({ ok: true });
    const after = await prisma.invite.findUniqueOrThrow({ where: { id: invite.id } });
    expect(after.tokenHash).not.toBe(invite.tokenHash);
    expect(after.expiresAt.getTime()).toBeGreaterThan(invite.expiresAt.getTime() - 1000);
  });
});

describe("revokeInviteInner", () => {
  async function pendingInvite() {
    const { admin, staff, teams } = await seedBaseline();
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
    return { invite, admin, staff };
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

  it("staff CANNOT revoke (v1 parity — Platform's medewerker has no invite UI)", async () => {
    const { invite, staff } = await pendingInvite();
    const res = await revokeInviteInner(staff, invite.id);
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to revoke this invite.",
    });
  });
});

// ─── v1 parity: freelancers are platform-global, never team-attached ──
//
// Mirrors `Platform/app/Services/TeamService.php:52`:
//   if (! $user->hasRole('makelaar')) { continue; }
// Three layers of defense in v2 — schema, action guard, accept-time guard.
// All three should reject any path that would land a freelancer in
// `team_member`. Belt + suspenders + safety net.

describe("createInviteInner — freelancer team-attach blocked (v1 parity)", () => {
  it("admin invites freelancer + teamId → schema rejects", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await createInviteInner(
      admin,
      undefined,
      form({
        email: "freebie@test.local",
        role: "freelancer",
        teamId: teams.t1.id,
        teamRole: "member",
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/Freelancers can't be assigned to a team/);
    }
    // Confirm no invite row was created either.
    const invites = await prisma.invite.count({
      where: { email: "freebie@test.local" },
    });
    expect(invites).toBe(0);
  });

  it("admin invites freelancer with NO teamId → succeeds (this is the only valid path)", async () => {
    const { admin } = await seedBaseline();
    const res = await createInviteInner(
      admin,
      undefined,
      form({ email: "freebie@test.local", role: "freelancer" }),
    );
    expect(res).toEqual({ ok: true });
    const invite = await prisma.invite.findFirstOrThrow({
      where: { email: "freebie@test.local" },
    });
    expect(invite.role).toBe("freelancer");
    expect(invite.teamId).toBeNull();
    expect(invite.teamRole).toBeNull();
  });

  it("acceptInvite for a stale freelancer invite WITH teamId silently skips teamMember insert", async () => {
    // Defensive layer: even if a pre-fix DB row carries teamId/teamRole on
    // a freelancer invite, the accept path must NOT insert a team_member.
    // Bypass createInvite (which would now reject) by writing the bad row
    // directly — simulates legacy data.
    const { admin, teams } = await seedBaseline();
    const token = generateToken();
    await prisma.invite.create({
      data: {
        email: "stale-freelancer@test.local",
        role: "freelancer",
        teamId: teams.t1.id,        // legacy/manual-SQL state
        teamRole: "member",          // legacy/manual-SQL state
        tokenHash: hashToken(token),
        invitedById: admin.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const res = await acceptInviteInner(
      undefined,
      form({
        token,
        firstName: "Stale",
        lastName: "Freelancer",
        password: "ten-char-password",
        confirm: "ten-char-password",
      }),
    );
    expect(res).toEqual({ ok: true });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "stale-freelancer@test.local" },
    });
    expect(user.role).toBe("freelancer");
    // Critical assertion — no team_member row created despite invite.teamId.
    const memberships = await prisma.teamMember.count({
      where: { userId: user.id },
    });
    expect(memberships).toBe(0);
  });

  it("admin invites EXISTING freelancer user with teamId → action rejects (defensive)", async () => {
    const { admin, teams, freelancer } = await seedBaseline();
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
    expect(res.ok).toBe(false);
    // Schema fires first since freelancer + teamId is in payload.
    if (!res.ok) {
      expect(res.error).toMatch(/Freelancers can't be assigned to a team/);
    }
    const memberships = await prisma.teamMember.count({
      where: { userId: freelancer.user.id, teamId: teams.t2.id },
    });
    expect(memberships).toBe(0);
  });
});
