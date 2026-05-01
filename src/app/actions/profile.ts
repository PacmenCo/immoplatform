"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, generateToken, hashToken, type SessionWithUser } from "@/lib/auth";
import { makeAvatarKey, storage } from "@/lib/storage";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TO_EXT } from "@/lib/avatar";
import { emailVerificationEmail, sendEmail } from "@/lib/email";
import { emailVerificationUrl } from "@/lib/urls";
import { withSession, type ActionResult } from "./_types";

const emptyToNull = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v ? v : null));

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(255),
  phone: emptyToNull(40),
  region: emptyToNull(80),
  bio: emptyToNull(500),
});

/**
 * Create a one-shot email-verification token row and send the verify email.
 * Shared by updateProfile (on email change) and resendEmailVerification.
 */
async function startEmailVerification(opts: {
  userId: string;
  firstName: string;
  email: string;
  locale?: string;
}): Promise<void> {
  const token = generateToken();
  await prisma.emailVerification.create({
    data: {
      userId: opts.userId,
      email: opts.email,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  });
  const tpl = await emailVerificationEmail(
    {
      name: opts.firstName,
      verifyUrl: emailVerificationUrl(token),
    },
    opts.locale,
  );
  await sendEmail({ to: opts.email, ...tpl, locale: opts.locale });
  await audit({
    actorId: opts.userId,
    verb: "user.email_verification_sent",
    objectType: "user",
    objectId: opts.userId,
    metadata: { email: opts.email },
  });
}

/**
 * Session-accepting body of `updateProfile`. Exported for Vitest tests.
 */
export async function updateProfileInner(
  session: SessionWithUser,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    region: formData.get("region"),
    bio: formData.get("bio"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "errors.validation.invalidInput",
    };
  }
  const d = parsed.data;

  // On email change: clear emailVerifiedAt and send a fresh verification
  // email. Keeps the "verified" badge honest about the current address.
  const emailChanged = d.email !== session.user.email.toLowerCase();

  if (emailChanged) {
    const taken = await prisma.user.findFirst({
      where: { email: d.email, id: { not: session.user.id } },
      select: { id: true },
    });
    if (taken) {
      return { ok: false, error: "errors.auth.emailTakenOnAnotherAccount" };
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      region: d.region,
      bio: d.bio,
      ...(emailChanged ? { emailVerifiedAt: null } : {}),
    },
  });

  if (emailChanged) {
    await audit({
      actorId: session.user.id,
      verb: "user.email_changed",
      objectType: "user",
      objectId: session.user.id,
      metadata: { from: session.user.email, to: d.email },
    });
    // Wrap the send so a mailer outage doesn't roll back the profile update —
    // the user can hit "Resend verification" from the not-verified banner.
    await startEmailVerification({
      userId: session.user.id,
      firstName: d.firstName,
      email: d.email,
      locale: session.user.locale,
    }).catch((err) => {
      console.warn("email verification send failed:", err);
    });
  }

  await audit({
    actorId: session.user.id,
    verb: "user.profile_updated",
    objectType: "user",
    objectId: session.user.id,
    metadata: { emailChanged },
  });

  revalidatePath("/dashboard/settings");
  // The dashboard layout renders the viewer's name + avatar in the sidebar;
  // refresh the RSC tree so the change shows without a manual reload.
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export const updateProfile = withSession(updateProfileInner);

// ─── Resend / confirm verification ─────────────────────────────────

/**
 * Fire a new verification email for the caller's current address.
 */
/**
 * Session-accepting body of `resendEmailVerification`. Exported for tests.
 */
export async function resendEmailVerificationInner(
  session: SessionWithUser,
): Promise<ActionResult> {
  if (session.user.emailVerifiedAt) {
    return { ok: false, error: "errors.verification.alreadyVerified" };
  }
  try {
    await startEmailVerification({
      userId: session.user.id,
      firstName: session.user.firstName,
      email: session.user.email,
      locale: session.user.locale,
    });
  } catch (err) {
    console.warn("resend verification failed:", err);
    return { ok: false, error: "errors.verification.sendFailed" };
  }
  return { ok: true };
}

export const resendEmailVerification = withSession(resendEmailVerificationInner);

/**
 * Consume a verification-email token. Unauthenticated — the token itself is
 * proof. Marks the user verified only if the token's snapshotted email still
 * matches the user's current email (a subsequent email change invalidates
 * outstanding tokens via this check).
 */
export async function confirmEmailVerification(
  token: string,
): Promise<ActionResult<{ email: string }>> {
  if (!token || typeof token !== "string" || token.length < 10) {
    return { ok: false, error: "errors.verification.tokenMissing" };
  }
  const row = await prisma.emailVerification.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, email: true, emailVerifiedAt: true } },
    },
  });
  if (!row) {
    return { ok: false, error: "errors.verification.linkInvalid" };
  }
  if (row.usedAt) {
    return { ok: false, error: "errors.verification.linkUsed" };
  }
  if (row.expiresAt < new Date()) {
    return { ok: false, error: "errors.verification.linkExpired" };
  }
  if (row.user.email !== row.email) {
    return {
      ok: false,
      error: "errors.verification.linkStaleEmail",
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerification.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await audit({
    actorId: row.userId,
    verb: "user.email_verified",
    objectType: "user",
    objectId: row.userId,
    metadata: { email: row.email },
  });

  revalidatePath("/dashboard/settings");
  return { ok: true, data: { email: row.email } };
}

/**
 * Session-accepting body of `uploadAvatar`. Exported for tests.
 */
export async function uploadAvatarInner(
  session: SessionWithUser,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "errors.profile.pickImage" };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: "errors.profile.imageTooLarge" };
  }
  const mime = file.type.toLowerCase();
  const ext = AVATAR_MIME_TO_EXT[mime];
  if (!ext) {
    return { ok: false, error: "errors.profile.imageWrongFormat" };
  }

  const store = storage();
  const version = Date.now().toString(36);
  const key = makeAvatarKey({ userId: session.user.id, version, ext });
  const buf = Buffer.from(await file.arrayBuffer());

  // Upload bytes and read the prior key in parallel; the DB swap has to wait
  // for the put (we don't want the column pointing at missing bytes) but the
  // prior-key lookup is independent.
  const [, previous] = await Promise.all([
    store.put(key, buf, { mimeType: mime }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { avatarUrl: true },
    }),
  ]);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: key },
  });
  if (previous?.avatarUrl && previous.avatarUrl !== key) {
    await store.delete(previous.avatarUrl).catch((err) => {
      console.warn("avatar cleanup failed:", err);
    });
  }

  await audit({
    actorId: session.user.id,
    verb: "user.avatar_uploaded",
    objectType: "user",
    objectId: session.user.id,
    metadata: { sizeBytes: file.size, mime },
  });

  revalidatePath("/dashboard/settings");
  // The dashboard layout renders the viewer's name + avatar in the sidebar;
  // refresh the RSC tree so the change shows without a manual reload.
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export const uploadAvatar = withSession(uploadAvatarInner);

/**
 * Session-accepting body of `removeAvatar`. Exported for tests.
 */
export async function removeAvatarInner(session: SessionWithUser): Promise<ActionResult> {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });
  if (!user?.avatarUrl) return { ok: true };

  const store = storage();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: null },
  });
  await store.delete(user.avatarUrl).catch((err) => {
    console.warn("avatar cleanup failed:", err);
  });

  await audit({
    actorId: session.user.id,
    verb: "user.avatar_removed",
    objectType: "user",
    objectId: session.user.id,
  });

  revalidatePath("/dashboard/settings");
  // The dashboard layout renders the viewer's name + avatar in the sidebar;
  // refresh the RSC tree so the change shows without a manual reload.
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export const removeAvatar = withSession(removeAvatarInner);
