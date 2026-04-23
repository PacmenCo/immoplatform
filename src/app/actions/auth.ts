"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  audit,
  clearSession,
  createSession,
  generateToken,
  getSession,
  hashPassword,
  hashToken,
  verifyPassword,
} from "@/lib/auth";
import { passwordResetEmail, sendEmail } from "@/lib/email";
import {
  checkRateLimit,
  clientIpFromHeaders,
  RATE_LIMITS,
  resetRateLimit,
} from "@/lib/rateLimit";
import { passwordResetUrl } from "@/lib/urls";
import type { ActionResult } from "./_types";

function rateLimitedError(retryAfterSec: number): ActionResult {
  const minutes = Math.ceil(retryAfterSec / 60);
  return {
    ok: false,
    error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  };
}

// ─── LOGIN ─────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1),
});

export async function login(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Enter your email and password." };
  }

  // Platform parity: 5 attempts per (email, ip) per 60s. IP-awareness stops
  // one attacker from locking a victim out by guessing their email + wrong
  // password from a different machine.
  const ip = clientIpFromHeaders(await headers());
  const rlKey = `login:${parsed.data.email}:${ip}`;
  const rl = checkRateLimit(rlKey, RATE_LIMITS.login);
  if (!rl.ok) return rateLimitedError(rl.retryAfterSec);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Constant-time-ish dance: always run bcrypt.compare so timing doesn't leak
  // account existence.
  const dummyHash = "$2a$12$yZTWcRRUaNXOHLwI..ZhJeiwCgAkuvZZ7BtpoWsQJ4JCW8mdmXqJG";
  const hashToCheck = user?.passwordHash ?? dummyHash;
  const ok = await verifyPassword(parsed.data.password, hashToCheck);

  if (!user || !ok || user.deletedAt) {
    await audit({
      verb: "auth.login_failed",
      metadata: { email: parsed.data.email },
    });
    return { ok: false, error: "Invalid email or password." };
  }

  resetRateLimit(rlKey);

  // Pick an active team if the user has memberships.
  const firstMembership = await prisma.teamMember.findFirst({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
  });

  await createSession({
    userId: user.id,
    activeTeamId: firstMembership?.teamId ?? null,
  });

  await audit({
    actorId: user.id,
    verb: "user.signed_in",
    objectType: "user",
    objectId: user.id,
  });

  redirect("/dashboard");
}

// ─── LOGOUT ────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const session = await getSession();
  if (session) {
    await audit({
      actorId: session.user.id,
      verb: "user.signed_out",
      objectType: "user",
      objectId: session.user.id,
    });
  }
  await clearSession();
  redirect("/login");
}

// ─── FORGOT PASSWORD ───────────────────────────────────────────────

const forgotSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
});

export async function forgotPassword(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  // Per-email throttle avoids email-flooding an account. Per-IP would be
  // stricter but would block NAT'd offices; per-email is the closer match
  // to Laravel's Password broker default.
  const rl = checkRateLimit(`forgot:${parsed.data.email}`, RATE_LIMITS.forgotPassword);
  if (!rl.ok) return rateLimitedError(rl.retryAfterSec);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user && !user.deletedAt) {
    const token = generateToken();
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
      },
    });
    const tpl = passwordResetEmail({
      name: user.firstName,
      resetUrl: passwordResetUrl(token),
    });
    await sendEmail({ to: user.email, ...tpl });
  }

  await audit({
    actorId: user?.id ?? null,
    verb: "password_reset.requested",
    metadata: { email: parsed.data.email, found: Boolean(user) },
  });

  // Always return ok to avoid email enumeration
  return { ok: true };
}

// ─── RESET PASSWORD ────────────────────────────────────────────────

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(10, "Password must be at least 10 characters."),
  confirm: z.string(),
});

export async function resetPassword(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return { ok: false, error: "Passwords don't match." };
  }

  // Guard token-consume from brute force; the window is long since legitimate
  // password-manager retries are rare.
  const tokenHash = hashToken(parsed.data.token);
  const rl = checkRateLimit(`reset:${tokenHash}`, RATE_LIMITS.resetPassword);
  if (!rl.ok) return rateLimitedError(rl.retryAfterSec);

  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return { ok: false, error: "This reset link is invalid or has expired." };
  }
  if (reset.user.deletedAt) {
    return { ok: false, error: "This account is no longer active." };
  }

  const hash = await hashPassword(parsed.data.password);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: reset.userId },
      data: { passwordHash: hash },
    });
    await tx.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    });
    // Security: revoke all existing sessions when password is reset.
    await tx.session.updateMany({
      where: { userId: reset.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  // Sign the caller in with a fresh session.
  await createSession({ userId: reset.userId });

  await audit({
    actorId: reset.userId,
    verb: "user.password_changed",
    objectType: "user",
    objectId: reset.userId,
    metadata: { via: "reset" },
  });

  redirect("/dashboard");
}

// ─── SWITCH ACTIVE TEAM ────────────────────────────────────────────

export async function switchActiveTeam(teamId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
    include: { team: { select: { id: true } } },
  });
  if (!membership || !membership.team) {
    return { ok: false, error: "You're not a member of that team." };
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { activeTeamId: teamId },
  });

  await audit({
    actorId: session.user.id,
    verb: "session.team_switched",
    objectType: "team",
    objectId: teamId,
  });

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
