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
import { passwordResetEmail, sendEmail, userRegisteredEmail } from "@/lib/email";
import { collectPlatformAdmins } from "@/lib/assignment-recipients";
import { notify } from "@/lib/notify";
import { appBaseUrl } from "@/lib/urls";
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
  // Echo email back on every error path so the form doesn't blank it. Never
  // echo password — secrets must not round-trip through server-action state.
  const formValues = { email: String(formData.get("email") ?? "") };

  if (!parsed.success) {
    return { ok: false, error: "Enter your email and password.", formValues };
  }

  // Platform parity: 5 attempts per (email, ip) per 60s. IP-awareness stops
  // one attacker from locking a victim out by guessing their email + wrong
  // password from a different machine. The per-email cap is defense-in-depth
  // against IP rotation (XFF spoofing on direct-exposed deploys, residential
  // proxy farms in general).
  const ip = clientIpFromHeaders(await headers());
  const rlKey = `login:${parsed.data.email}:${ip}`;
  const rlPerEmail = checkRateLimit(`login:${parsed.data.email}`, RATE_LIMITS.loginPerEmail);
  if (!rlPerEmail.ok) return { ...rateLimitedError(rlPerEmail.retryAfterSec), formValues } as ActionResult;
  const rl = checkRateLimit(rlKey, RATE_LIMITS.login);
  if (!rl.ok) return { ...rateLimitedError(rl.retryAfterSec), formValues } as ActionResult;

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
    return { ok: false, error: "Invalid email or password.", formValues };
  }

  resetRateLimit(rlKey);
  resetRateLimit(`login:${parsed.data.email}`);

  // Pick an active team if the user has memberships.
  const firstMembership = await prisma.teamMember.findFirst({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
  });

  await createSession({
    userId: user.id,
    activeTeamId: firstMembership?.teamId ?? null,
  });

  // Platform parity (Models/User.php + 2025_06_19_211159 migration): bump
  // `lastLoginAt` only on successful password login — distinct from the
  // continuous `lastSeenAt` heartbeat that getSession() refreshes.
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await audit({
    actorId: user.id,
    verb: "user.signed_in",
    objectType: "user",
    objectId: user.id,
  });

  // Platform parity (`Login.php` `redirect()->intended()`): if the form
  // posts a `next` URL, route there instead. Validate it's a same-origin
  // path (starts with `/` and not `//` — the latter is a protocol-relative
  // URL that would jump origins). Fallback: assignments list, matching v1's
  // `route('assignments.index')`.
  const rawNext = String(formData.get("next") ?? "");
  const target =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard/assignments";
  redirect(target);
}

// ─── REGISTER ──────────────────────────────────────────────────────

// Platform parity (Auth/Register.php): self-serve realtor signup.
// v1's single `name` field is split into firstName + lastName here to
// match v2's User schema. Role is hard-coded to `realtor` (matches v1's
// `Role::where('name', 'makelaar')`); admins/staff are seeded or invited,
// not self-served. Auto-login + redirect to /dashboard mirrors v1's
// `Auth::login($user)` + `redirect(route('assignments.index'))`.
const registerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  email: z
    .string()
    .email("Enter a valid email address.")
    .max(255)
    .transform((s) => s.toLowerCase().trim())
    // The `@immo.test` domain is reserved server-side for the dev
    // account-switcher group (`src/lib/account-switcher.ts`). Refusing it at
    // registration prevents anyone from gaming the allowlist by claiming a
    // `@immo.test` email through the public flow.
    .refine((e) => !e.endsWith("@immo.test"), {
      message: "This email domain is not allowed.",
    }),
  password: z.string().min(10, "Password must be at least 10 characters."),
  confirm: z.string(),
  agency: z.string().trim().max(120).optional().or(z.literal("")),
  region: z.string().trim().max(120).optional().or(z.literal("")),
  acceptTerms: z.literal("on", {
    message: "You must accept the Terms and Privacy Policy.",
  }),
});

export async function register(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  // Preserve user-typed values across server-action errors so the form
  // doesn't blank out everything they typed. Password / confirm are
  // intentionally NOT echoed back — never round-trip secrets through
  // server-action state.
  const formValues = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    agency: String(formData.get("agency") ?? ""),
    region: String(formData.get("region") ?? ""),
  };

  const parsed = registerSchema.safeParse({
    ...formValues,
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    acceptTerms: formData.get("acceptTerms"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
      formValues,
    };
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return { ok: false, error: "Passwords don't match.", formValues };
  }

  // Rate-limit per IP — same window as forgot-password since both are
  // pre-auth surfaces and a low cap stops scripted account-farming.
  const ip = clientIpFromHeaders(await headers());
  const rl = checkRateLimit(`register:${ip}`, RATE_LIMITS.forgotPassword);
  if (!rl.ok) return { ...rateLimitedError(rl.retryAfterSec), formValues } as ActionResult;

  // Email-uniqueness check matches v1 `unique:users` rule. The error is
  // intentionally generic ("Account already exists with that email.") —
  // a precise "this email is taken" surfaces enumeration; we live with
  // the slight UX hit because the same hint shows on /forgot-password's
  // generic-success path anyway.
  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: "An account with that email already exists. Try logging in.",
      formValues,
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: "realtor",
      region: parsed.data.region || null,
      // bio borrows the agency text — v2's User schema has no `agency`
      // column, but a one-liner about who they are is useful as a starter.
      bio: parsed.data.agency || null,
    },
  });

  await audit({
    actorId: user.id,
    verb: "user.created",
    objectType: "user",
    objectId: user.id,
    metadata: { via: "self_register", role: "realtor" },
  });

  // Platform parity (EmailTypesSeeder `user_registered`): fan the new
  // sign-up out to every platform admin who hasn't opted out so the team
  // notices new accounts. Honors the `user.registered` opt-out via
  // `notify` → `shouldSendEmail`. Best-effort: don't block the signup
  // redirect on email delivery.
  const admins = await collectPlatformAdmins({ exclude: [user.id] });
  if (admins.length > 0) {
    const tpl = await userRegisteredEmail({
      newUserName: `${user.firstName} ${user.lastName}`,
      newUserEmail: user.email,
      newUserRole: "realtor",
      agency: parsed.data.agency || null,
      region: parsed.data.region || null,
      usersUrl: `${appBaseUrl()}/dashboard/users`,
    });
    await Promise.all(
      admins.map((to) => notify({ to, event: "user.registered", ...tpl })),
    );
  }

  await createSession({ userId: user.id, activeTeamId: null });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await audit({
    actorId: user.id,
    verb: "user.signed_in",
    objectType: "user",
    objectId: user.id,
  });

  // v1 parity: redirect to assignments.index after auto-login.
  redirect("/dashboard/assignments");
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

  // Per-email throttle avoids email-flooding a single account. Per-IP runs
  // alongside it to bound wordlist abuse — without it, an attacker with N
  // emails could fire 3N reset emails per window.
  const rl = checkRateLimit(`forgot:${parsed.data.email}`, RATE_LIMITS.forgotPassword);
  if (!rl.ok) return rateLimitedError(rl.retryAfterSec);
  const ip = clientIpFromHeaders(await headers());
  const rlIp = checkRateLimit(`forgot-ip:${ip}`, RATE_LIMITS.forgotPasswordPerIp);
  if (!rlIp.ok) return rateLimitedError(rlIp.retryAfterSec);

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
    const tpl = await passwordResetEmail({
      name: user.firstName,
      resetUrl: passwordResetUrl(token),
    });
    await sendEmail({ to: user.email, ...tpl });
  } else {
    // Equalize timing: when the user is unknown the function would otherwise
    // return ~10× faster than the existing-user branch (Prisma + token write
    // + email build). That gap leaks email enumeration even though the
    // response body is uniform. hashToken is the cheapest match for the
    // existing branch's dominant cost.
    hashToken(generateToken());
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

const INVALID_TOKEN_ERROR = "This reset link is invalid or has expired.";

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
    // Token validation issues should look identical to "expired/invalid"
    // — surfacing "Too small: expected …" otherwise leaks the schema
    // and gives an attacker a way to distinguish "token is shaped wrong"
    // from "token is correctly shaped but unknown". Other validation
    // errors (password length, missing confirm) keep their specific text.
    const tokenIssue = parsed.error.issues.find(
      (i) => i.path[0] === "token",
    );
    if (tokenIssue) {
      return { ok: false, error: INVALID_TOKEN_ERROR };
    }
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
    return { ok: false, error: INVALID_TOKEN_ERROR };
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

  redirect("/dashboard/assignments");
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
