"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, hashPassword, type SessionWithUser } from "@/lib/auth";
import { canAdminUsers } from "@/lib/permissions";
import { withSession, type ActionResult } from "./_types";

/**
 * Admin-only user management — edit / delete / role-change / password-reset
 * for someone other than yourself. Self-service equivalents live in
 * profile.ts + security.ts.
 */

const ROLES = ["admin", "staff", "realtor", "freelancer"] as const;

const editSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(255),
  role: z.enum(ROLES),
});

/**
 * Update name / email / role on another user. Admin-only. Unlike the
 * self-service profile action, this does NOT clear `emailVerifiedAt` on
 * email change — admins are trusted to know what they're doing.
 */
/**
 * Session-accepting body of `updateUserByAdmin`. Exported for Vitest tests;
 * the wrapped form redirects to the user page on success.
 */
export async function updateUserByAdminInner(
  session: SessionWithUser,
  userId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  if (!canAdminUsers(session)) {
    return { ok: false, error: "Only admins can edit other users." };
  }
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, deletedAt: true },
  });
  if (!target || target.deletedAt) {
    return { ok: false, error: "User not found." };
  }

  const parsed = editSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const d = parsed.data;

  if (d.email !== target.email) {
    const taken = await prisma.user.findFirst({
      where: { email: d.email, id: { not: userId } },
      select: { id: true },
    });
    if (taken) {
      return { ok: false, error: "That email is already in use on another account." };
    }
  }

  // Last-admin guard: demoting the only active admin leaves the platform
  // unmanageable. Platform has no such guard; we add it because a zero-admin
  // state is unrecoverable without direct DB access.
  if (target.role === "admin" && d.role !== "admin") {
    const otherAdmins = await prisma.user.count({
      where: { role: "admin", deletedAt: null, id: { not: userId } },
    });
    if (otherAdmins === 0) {
      return {
        ok: false,
        error: "Can't demote the last admin. Promote another user to admin first.",
      };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      role: d.role,
    },
  });

  await audit({
    actorId: session.user.id,
    verb: "user.profile_updated",
    objectType: "user",
    objectId: userId,
    metadata: { via: "admin_edit", emailChanged: d.email !== target.email },
  });
  if (d.role !== target.role) {
    await audit({
      actorId: session.user.id,
      verb: "user.role_changed",
      objectType: "user",
      objectId: userId,
      metadata: { from: target.role, to: d.role },
    });
  }

  revalidatePath("/dashboard/users");
  revalidatePath(`/dashboard/users/${userId}`);
  return { ok: true };
}

export const updateUserByAdmin = withSession(async (
  session: SessionWithUser,
  userId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  const result = await updateUserByAdminInner(session, userId, _prev, formData);
  if (result.ok) redirect(`/dashboard/users/${userId}`);
  return result;
});

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(200, "Keep it under 200 characters.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/[0-9]/, "Include at least one number."),
    confirm: z.string().min(1, "Confirm the new password."),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Password and confirmation don't match.",
    path: ["confirm"],
  });

/**
 * Admin sets a new password on another user's account. Revokes every active
 * session for that user so the old password can't be reused from existing
 * browsers — matches the self-service change-password flow.
 */
/**
 * Session-accepting body of `resetUserPassword`. Exported for Vitest tests.
 */
export async function resetUserPasswordInner(
  session: SessionWithUser,
  userId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  if (!canAdminUsers(session)) {
    return { ok: false, error: "Only admins can reset another user's password." };
  }
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deletedAt: true },
  });
  if (!target || target.deletedAt) return { ok: false, error: "User not found." };

  const parsed = passwordSchema.safeParse({
    password: formData.get("password") ?? "",
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }

  const newHash = await hashPassword(parsed.data.password);
  const { revokedCount } = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
    const { count } = await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revokedCount: count };
  });

  await audit({
    actorId: session.user.id,
    verb: "user.password_changed",
    objectType: "user",
    objectId: userId,
    metadata: { via: "admin_reset" },
  });
  if (revokedCount > 0) {
    await audit({
      actorId: session.user.id,
      verb: "user.sessions_revoked",
      objectType: "user",
      objectId: userId,
      metadata: { via: "admin_password_reset", count: revokedCount },
    });
  }

  revalidatePath(`/dashboard/users/${userId}`);
  return { ok: true };
}

export const resetUserPassword = withSession(resetUserPasswordInner);

/**
 * Session-accepting body of `deleteUserByAdmin`. Soft-delete another user.
 * Admin-only. Refuses to delete self (use the account-deletion flow in
 * settings instead) and refuses to delete the last admin. Revokes all
 * sessions so the deleted account can't be used.
 */
export async function deleteUserByAdminInner(
  session: SessionWithUser,
  userId: string,
): Promise<ActionResult> {
  if (!canAdminUsers(session)) {
    return { ok: false, error: "Only admins can delete other users." };
  }
  if (userId === session.user.id) {
    return {
      ok: false,
      error: "Use the self-service delete flow in Settings to remove your own account.",
    };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, deletedAt: true, firstName: true, lastName: true },
  });
  if (!target || target.deletedAt) return { ok: false, error: "User not found." };

  if (target.role === "admin") {
    const otherAdmins = await prisma.user.count({
      where: { role: "admin", deletedAt: null, id: { not: userId } },
    });
    if (otherAdmins === 0) {
      return {
        ok: false,
        error: "Can't delete the last admin. Promote another user to admin first.",
      };
    }
  }

  // Platform parity (Platform/UserController.php:294-297): refuse to delete
  // a user that's still attached to a team. Otherwise the team's owner FK
  // (or the membership row) hangs off a soft-deleted user, surfacing as a
  // ghost owner in the UI. Admin must reassign / remove the user from
  // teams first.
  const teamMembershipCount = await prisma.teamMember.count({
    where: { userId },
  });
  if (teamMembershipCount > 0) {
    return {
      ok: false,
      error:
        "Remove this user from all teams before deleting. They still belong to one or more teams.",
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    }),
    prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await audit({
    actorId: session.user.id,
    verb: "user.deleted",
    objectType: "user",
    objectId: userId,
    metadata: {
      via: "admin",
      name: `${target.firstName} ${target.lastName}`,
      role: target.role,
    },
  });

  revalidatePath("/dashboard/users");
  revalidatePath(`/dashboard/users/${userId}`);
  return { ok: true };
}

export const deleteUserByAdmin = withSession(deleteUserByAdminInner);
