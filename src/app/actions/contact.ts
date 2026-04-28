"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, requireSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { contactSubmissionEmail, sendEmail } from "@/lib/email";
import { appBaseUrl } from "@/lib/urls";
import {
  checkRateLimit,
  clientIpFromHeaders,
  RATE_LIMITS,
} from "@/lib/rateLimit";
import { withSession, type ActionResult } from "./_types";

/**
 * Public contact-form submission. Anyone can call this — no auth required.
 * Rate-limited per IP. Includes a honeypot field (`website`) for bot
 * filtering: if filled, we silently return ok without persisting or
 * emailing, so the bot thinks it succeeded and doesn't retry.
 *
 * On success: persists a `ContactSubmission` row + sends an email to the
 * `NOTIFY_CONTACT_TO` env var (falls back to jordan@asbestexperts.be) with
 * Reply-To set to the visitor's email.
 */

const submitSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Please enter your name.")
    .max(120, "Keep your name under 120 characters."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(255),
  phone: z
    .string()
    .trim()
    .max(40, "Phone number is too long.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  subject: z
    .string()
    .trim()
    .max(200, "Keep the subject under 200 characters.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  message: z
    .string()
    .trim()
    .min(1, "Please write a message.")
    .max(4000, "Keep the message under 4000 characters."),
});

const FALLBACK_NOTIFY_TO = "jordan@asbestexperts.be";

export async function submitContactFormInner(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  // Honeypot — a hidden field a real user never sees. Filled = bot. Return
  // ok so the bot doesn't retry, but skip every side-effect.
  const honeypot = (formData.get("website") as string | null) ?? "";
  if (honeypot.trim().length > 0) {
    return { ok: true };
  }

  const rawValues = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) ?? "",
    subject: (formData.get("subject") as string) ?? "",
    message: formData.get("message") as string,
  };
  // Form values to echo back on validation error so the user doesn't lose
  // what they typed. Mirror the login/register pattern.
  const formValues = {
    name: rawValues.name ?? "",
    email: rawValues.email ?? "",
    phone: rawValues.phone ?? "",
    subject: rawValues.subject ?? "",
    message: rawValues.message ?? "",
  };

  const parsed = submitSchema.safeParse(rawValues);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
      formValues,
    };
  }

  // Per-IP rate limit. clientIpFromHeaders falls back to "unknown" when
  // TRUST_PROXY=0; in that case the limit becomes a global cap, which is
  // the safer failure mode for a public form.
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  const ua = h.get("user-agent")?.slice(0, 500) ?? null;
  const rl = checkRateLimit(`contact:${ip}`, RATE_LIMITS.contactSubmission);
  if (!rl.ok) {
    const minutes = Math.ceil(rl.retryAfterSec / 60);
    return {
      ok: false,
      error: `Too many submissions from this network. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      formValues,
    };
  }

  const d = parsed.data;
  const row = await prisma.contactSubmission.create({
    data: {
      name: d.name,
      email: d.email,
      phone: d.phone,
      subject: d.subject,
      message: d.message,
      ipAddress: ip === "unknown" ? null : ip,
      userAgent: ua,
    },
    select: { id: true },
  });

  // Best-effort email — don't fail the submission if Postmark hiccups.
  // The row is in the DB and visible in the admin dashboard regardless.
  const notifyTo = process.env.NOTIFY_CONTACT_TO || FALLBACK_NOTIFY_TO;
  try {
    const tpl = await contactSubmissionEmail({
      name: d.name,
      email: d.email,
      phone: d.phone,
      subject: d.subject,
      message: d.message,
      submissionId: row.id,
      adminUrl: `${appBaseUrl()}/dashboard/contact-messages`,
    });
    await sendEmail({
      to: notifyTo,
      replyTo: d.email,
      ...tpl,
    });
  } catch (err) {
    console.warn("contact submission email failed:", err);
  }

  revalidatePath("/dashboard/contact-messages");
  return { ok: true };
}

export const submitContactForm = submitContactFormInner;

// ─── Admin actions ──────────────────────────────────────────────────

/**
 * Toggle handled state on a contact submission. Admin only.
 */
export const markContactHandled = withSession(async (
  session,
  id: string,
  handled: boolean,
): Promise<ActionResult> => {
  if (!hasRole(session, "admin")) {
    return { ok: false, error: "Only admins can update contact submissions." };
  }
  const existing = await prisma.contactSubmission.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Submission not found." };

  await prisma.contactSubmission.update({
    where: { id },
    data: handled
      ? { handledById: session.user.id, handledAt: new Date() }
      : { handledById: null, handledAt: null },
  });

  await audit({
    actorId: session.user.id,
    verb: handled ? "contact.handled" : "contact.unhandled",
    objectType: "contact_submission",
    objectId: id,
  });

  revalidatePath("/dashboard/contact-messages");
  return { ok: true };
});

/**
 * Update internal admin notes on a submission. Admin only.
 */
const notesSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(2000, "Keep notes under 2000 characters.")
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export const updateContactNotes = withSession(async (
  session,
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  if (!hasRole(session, "admin")) {
    return { ok: false, error: "Only admins can update contact submissions." };
  }
  const parsed = notesSchema.safeParse({
    notes: (formData.get("notes") as string) ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid notes.",
    };
  }

  const existing = await prisma.contactSubmission.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Submission not found." };

  await prisma.contactSubmission.update({
    where: { id },
    data: { notes: parsed.data.notes },
  });

  revalidatePath("/dashboard/contact-messages");
  return { ok: true };
});

// Required so the dashboard page can fetch session in the action's typed
// signature without re-importing from auth.
void requireSession;
