"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  audit,
  createSession,
  generateToken,
  hashPassword,
  hashToken,
  requireRole,
  requireSession,
  type SessionWithUser,
} from "@/lib/auth";
import { addedToTeamEmail, inviteEmail, sendEmail } from "@/lib/email";
import type { ActionResult } from "./_types";

const createInviteSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  role: z.enum(["admin", "staff", "realtor", "freelancer"]),
  teamId: z.string().optional().or(z.literal("")),
  teamRole: z.enum(["owner", "member"]).optional().or(z.literal("")),
  note: z.string().max(500).optional(),
});

// ─── CREATE INVITE ─────────────────────────────────────────────────

export async function createInvite(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireRole(["admin", "staff", "realtor"]);
  } catch {
    return { ok: false, error: "You don't have permission to invite users." };
  }

  const raw = {
    email: formData.get("email") as string,
    role: formData.get("role") as string,
    teamId: (formData.get("teamId") as string) || "",
    teamRole: (formData.get("teamRole") as string) || "",
    note: (formData.get("note") as string) || undefined,
  };

  const parsed = createInviteSchema.safeParse(raw);
  if (!parsed.success) {
    const err = parsed.error.issues[0];
    return { ok: false, error: err?.message ?? "Invalid input." };
  }

  const { email, role, note } = parsed.data;
  const teamId = parsed.data.teamId || null;
  const teamRole = parsed.data.teamRole || null;

  if (teamId && !teamRole) {
    return { ok: false, error: "Pick a team role (Member or Owner)." };
  }
  if (teamRole && !teamId) {
    return { ok: false, error: "Pick a team before setting a team role." };
  }

  // Enforce single-owner policy: if team already has an owner, reject Owner role.
  if (teamId && teamRole === "owner") {
    const existingOwner = await prisma.teamMember.findFirst({
      where: { teamId, teamRole: "owner" },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (existingOwner) {
      const ownerName = `${existingOwner.user.firstName} ${existingOwner.user.lastName}`;
      return {
        ok: false,
        error: `This team already has an owner (${ownerName}). Invite as a member, or transfer ownership first.`,
      };
    }
  }

  // Permission checks beyond role:
  if (session.user.role === "realtor") {
    // Realtors can only invite to teams they own, and only realtor/freelancer.
    if (role === "admin" || role === "staff") {
      return { ok: false, error: "Only admins can invite admin or staff users." };
    }
    if (!teamId) {
      return { ok: false, error: "You must assign the invitee to your team." };
    }
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.user.id } },
    });
    if (!membership || membership.teamRole !== "owner") {
      return { ok: false, error: "You can only invite to teams you own." };
    }
  }
  if (session.user.role === "staff" && role === "admin") {
    return { ok: false, error: "Staff cannot invite admins." };
  }

  // Existing user → add to team silently instead of creating an invite.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!teamId || !teamRole) {
      return {
        ok: false,
        error: "This email already has an account. Pick a team to add them to.",
      };
    }
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId: existing.id } },
      create: { teamId, userId: existing.id, teamRole },
      update: { teamRole },
    });
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    const tpl = addedToTeamEmail({
      inviterName: `${session.user.firstName} ${session.user.lastName}`,
      teamName: team!.name,
      teamRole,
      loginUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/login`,
    });
    await sendEmail({ to: email, ...tpl });
    await audit({
      actorId: session.user.id,
      verb: "team.member_added",
      objectType: "team",
      objectId: teamId,
      metadata: { addedUserId: existing.id, teamRole },
    });
    revalidatePath("/dashboard/users");
    return { ok: true };
  }

  // Reject duplicate pending invites for this email.
  const existingPending = await prisma.invite.findFirst({
    where: { email, acceptedAt: null, revokedAt: null },
  });
  if (existingPending) {
    return {
      ok: false,
      error: "There's already a pending invite for this email. Revoke it first.",
    };
  }

  // Create invite.
  const token = generateToken();
  const invite = await prisma.invite.create({
    data: {
      email,
      role,
      teamId,
      teamRole,
      tokenHash: hashToken(token),
      invitedById: session.user.id,
      note: note || null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    include: { team: true },
  });

  const acceptUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/invites/${token}`;
  const tpl = inviteEmail({
    inviterName: `${session.user.firstName} ${session.user.lastName}`,
    acceptUrl,
    role,
    teamName: invite.team?.name,
    teamRole,
    note: note || null,
    expiresAt: invite.expiresAt,
  });
  await sendEmail({ to: email, ...tpl });

  await audit({
    actorId: session.user.id,
    verb: "invite.sent",
    objectType: "invite",
    objectId: invite.id,
    metadata: { email, role, teamId, teamRole },
  });

  revalidatePath("/dashboard/users");
  redirect("/dashboard/users");
}

// ─── GET INVITE BY TOKEN (for the accept page) ─────────────────────

export async function getInviteByToken(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      team: true,
      invitedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!invite) return { status: "not_found" as const };
  if (invite.revokedAt) return { status: "revoked" as const };
  if (invite.acceptedAt) return { status: "accepted" as const };
  if (invite.expiresAt < new Date()) return { status: "expired" as const };
  return { status: "ok" as const, invite };
}

// ─── ACCEPT INVITE ─────────────────────────────────────────────────

const acceptSchema = z.object({
  token: z.string().min(10),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: z.string().min(10, "Password must be at least 10 characters."),
  confirm: z.string(),
});

export async function acceptInvite(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    token: formData.get("token") as string,
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    password: formData.get("password") as string,
    confirm: formData.get("confirm") as string,
  };
  const parsed = acceptSchema.safeParse(raw);
  if (!parsed.success) {
    const err = parsed.error.issues[0];
    return { ok: false, error: err?.message ?? "Invalid input." };
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return { ok: false, error: "Passwords don't match." };
  }

  const res = await getInviteByToken(parsed.data.token);
  if (res.status !== "ok") {
    return {
      ok: false,
      error: {
        not_found: "This invite doesn't exist.",
        revoked: "This invite has been revoked.",
        accepted: "This invite has already been used.",
        expired: "This invite has expired. Ask to be re-invited.",
      }[res.status],
    };
  }
  const invite = res.invite;

  // Block if email somehow already has a user (race between invite + self-register)
  const clash = await prisma.user.findUnique({ where: { email: invite.email } });
  if (clash) {
    return {
      ok: false,
      error: "An account with this email already exists. Try signing in.",
    };
  }

  const hash = await hashPassword(parsed.data.password);

  let user;
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Optimistic lock: claim the invite first. If another concurrent request
      // already accepted it (or it was revoked/expired between pre-check and
      // here), updateMany reports count: 0 and we bail with a friendly error.
      const claim = await tx.invite.updateMany({
        where: {
          id: invite.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (claim.count === 0) {
        throw new Error("INVITE_CLAIMED");
      }
      const user = await tx.user.create({
        data: {
          email: invite.email,
          passwordHash: hash,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          role: invite.role,
          emailVerifiedAt: new Date(),
        },
      });
      if (invite.teamId && invite.teamRole) {
        await tx.teamMember.create({
          data: {
            teamId: invite.teamId,
            userId: user.id,
            teamRole: invite.teamRole,
          },
        });
      }
      return { user };
    });
    user = result.user;
  } catch (err) {
    if (err instanceof Error && err.message === "INVITE_CLAIMED") {
      return {
        ok: false,
        error: "This invite has already been used or is no longer valid.",
      };
    }
    throw err;
  }

  await createSession({
    userId: user.id,
    activeTeamId: invite.teamId ?? null,
  });

  await audit({
    actorId: user.id,
    verb: "user.created",
    objectType: "user",
    objectId: user.id,
    metadata: { via: "invite", inviteId: invite.id },
  });

  redirect("/dashboard");
}

// ─── RESEND / REVOKE ───────────────────────────────────────────────

const RESEND_WINDOW_MS = 60 * 60 * 1000; // 1h
const RESEND_MAX_PER_WINDOW = 3;

/**
 * Can `session` act on `invite` (resend or revoke)?
 * - admin / staff: any invite
 * - realtor: only invites they sent, for a team they still own
 * - freelancer: never
 */
async function canActOnInvite(
  session: SessionWithUser,
  invite: { invitedById: string; teamId: string | null },
): Promise<boolean> {
  if (session.user.role === "admin" || session.user.role === "staff") return true;
  if (session.user.role !== "realtor") return false;
  if (invite.invitedById !== session.user.id) return false;
  if (!invite.teamId) return false;
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: invite.teamId, userId: session.user.id } },
  });
  return membership?.teamRole === "owner";
}

export async function resendInvite(inviteId: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    include: { team: true, invitedBy: true },
  });
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.acceptedAt) return { ok: false, error: "Invite already accepted." };
  if (invite.revokedAt) return { ok: false, error: "Invite revoked." };

  if (!(await canActOnInvite(session, invite))) {
    return { ok: false, error: "You don't have permission to resend this invite." };
  }

  // Rolling-window rate limit. If the last resend was > 1h ago, the counter
  // resets — so a stuck invite doesn't become permanently locked out.
  const msSinceLast = invite.lastResentAt
    ? Date.now() - invite.lastResentAt.getTime()
    : Infinity;
  const windowOpen = msSinceLast >= RESEND_WINDOW_MS;
  const effectiveCount = windowOpen ? 0 : invite.resendCount;
  if (effectiveCount >= RESEND_MAX_PER_WINDOW) {
    return {
      ok: false,
      error: "Rate limited — too many resends in the last hour. Try again later.",
    };
  }

  const token = generateToken();
  const updated = await prisma.invite.update({
    where: { id: invite.id },
    data: {
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      resendCount: windowOpen ? 1 : { increment: 1 },
      lastResentAt: new Date(),
    },
  });

  const acceptUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/invites/${token}`;
  const tpl = inviteEmail({
    inviterName: `${invite.invitedBy.firstName} ${invite.invitedBy.lastName}`,
    acceptUrl,
    role: invite.role,
    teamName: invite.team?.name,
    teamRole: invite.teamRole,
    note: invite.note,
    expiresAt: updated.expiresAt,
  });
  await sendEmail({ to: invite.email, ...tpl });

  await audit({
    actorId: session.user.id,
    verb: "invite.resent",
    objectType: "invite",
    objectId: invite.id,
    metadata: { email: invite.email, resendCount: updated.resendCount },
  });

  revalidatePath("/dashboard/users");
  return { ok: true };
}

export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.acceptedAt) return { ok: false, error: "Invite already accepted." };
  if (invite.revokedAt) return { ok: true }; // idempotent

  if (!(await canActOnInvite(session, invite))) {
    return { ok: false, error: "You don't have permission to revoke this invite." };
  }

  await prisma.invite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
  });

  await audit({
    actorId: session.user.id,
    verb: "invite.revoked",
    objectType: "invite",
    objectId: inviteId,
    metadata: { email: invite.email },
  });

  revalidatePath("/dashboard/users");
  return { ok: true };
}
