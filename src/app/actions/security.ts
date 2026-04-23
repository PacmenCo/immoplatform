"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  audit,
  clearSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { withSession, type ActionResult } from "./_types";

/**
 * Self-service security actions: change own password, delete own account.
 * Delete is implemented as soft-delete (User.deletedAt) so audit history and
 * any created-by foreign keys keep pointing at a real row.
 */

// ─── Change password ───────────────────────────────────────────────

const passwordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(200, "Keep it under 200 characters.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/[0-9]/, "Include at least one number."),
    confirmPassword: z.string().min(1, "Confirm the new password."),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New password and confirmation don't match.",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "Choose a password different from your current one.",
    path: ["newPassword"],
  });

export const changePassword = withSession(async (
  session,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { passwordHash } = (await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  })) ?? { passwordHash: null };

  if (!passwordHash) {
    // Users who signed up via invite + password-reset flow always have a hash.
    // A missing hash is a data bug; fail safely rather than letting the change go through.
    return { ok: false, error: "Your account has no password set. Use the forgot-password flow to set one." };
  }

  const ok = await verifyPassword(parsed.data.currentPassword, passwordHash);
  if (!ok) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const newHash = await hashPassword(parsed.data.newPassword);

  const { revokedCount } = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newHash },
    });
    // Security: revoke every OTHER session on password change. The current
    // session stays so the user isn't kicked out of the page they just used.
    const { count } = await tx.session.updateMany({
      where: {
        userId: session.user.id,
        revokedAt: null,
        NOT: { id: session.id },
      },
      data: { revokedAt: new Date() },
    });
    return { revokedCount: count };
  });

  await audit({
    actorId: session.user.id,
    verb: "user.password_changed",
    objectType: "user",
    objectId: session.user.id,
    metadata: { via: "settings" },
  });
  if (revokedCount > 0) {
    await audit({
      actorId: session.user.id,
      verb: "user.sessions_revoked",
      objectType: "user",
      objectId: session.user.id,
      metadata: { via: "password_change", count: revokedCount },
    });
  }

  revalidatePath("/dashboard/settings/security");
  return { ok: true };
});

// ─── Delete own account (self-service) ─────────────────────────────

const deleteSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm."),
});

export const deleteOwnAccount = withSession(async (
  session,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  const parsed = deleteSchema.safeParse({
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter your password." };
  }
  const { passwordHash } = (await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  })) ?? { passwordHash: null };

  if (!passwordHash) {
    return { ok: false, error: "Your account has no password set — cannot confirm deletion." };
  }
  const ok = await verifyPassword(parsed.data.password, passwordHash);
  if (!ok) {
    return { ok: false, error: "Password is incorrect." };
  }

  // Safety: don't let the last active admin vanish. Platform has no such
  // guard; we add it because a zero-admin state is unrecoverable without
  // direct DB access.
  if (session.user.role === "admin") {
    const remainingAdmins = await prisma.user.count({
      where: {
        role: "admin",
        deletedAt: null,
        id: { not: session.user.id },
      },
    });
    if (remainingAdmins === 0) {
      return {
        ok: false,
        error: "You are the last admin. Promote another user before deleting your account.",
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: { deletedAt: new Date() },
    });
    // Revoke every session so the account can't be used anywhere.
    await tx.session.updateMany({
      where: { userId: session.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  await audit({
    actorId: session.user.id,
    verb: "user.deleted",
    objectType: "user",
    objectId: session.user.id,
    metadata: { via: "self_service" },
  });

  await clearSession();
  redirect("/login?deleted=1");
});

// ─── Revoke one session / sign out everywhere ─────────────────────

/**
 * Revoke a single session by id. Only the owning user can revoke their own
 * sessions — no cross-user reach. If the revoked session is the current one,
 * the browser loses auth on the next request (getSession checks revokedAt).
 */
export const revokeSession = withSession(async (
  session,
  sessionId: string,
): Promise<ActionResult> => {
  if (!sessionId || typeof sessionId !== "string") {
    return { ok: false, error: "Invalid session id." };
  }
  const target = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, revokedAt: true },
  });
  if (!target || target.userId !== session.user.id) {
    return { ok: false, error: "Session not found." };
  }
  if (target.revokedAt) return { ok: true }; // idempotent

  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });

  await audit({
    actorId: session.user.id,
    verb: "user.sessions_revoked",
    objectType: "user",
    objectId: session.user.id,
    metadata: { via: "revoke_one", count: 1 },
  });

  revalidatePath("/dashboard/settings/security");
  return { ok: true };
});

/**
 * Revoke every active session EXCEPT the caller's current one. The current
 * session stays so the user isn't signed out of the page they used to trigger
 * this. Callers who want to also sign out locally should follow up with a
 * plain /api logout.
 */
export const signOutEverywhere = withSession(async (
  session,
): Promise<ActionResult<{ count: number }>> => {
  const { count } = await prisma.session.updateMany({
    where: {
      userId: session.user.id,
      revokedAt: null,
      NOT: { id: session.id },
    },
    data: { revokedAt: new Date() },
  });

  if (count > 0) {
    await audit({
      actorId: session.user.id,
      verb: "user.sessions_revoked",
      objectType: "user",
      objectId: session.user.id,
      metadata: { via: "sign_out_everywhere", count },
    });
  }

  revalidatePath("/dashboard/settings/security");
  return { ok: true, data: { count } };
});
