/**
 * Email transport dispatcher.
 *
 * Dev default (EMAIL_PROVIDER unset or "dev"): logs to the server console.
 * Prod:
 *   - EMAIL_PROVIDER=postmark + POSTMARK_TOKEN + EMAIL_FROM (reuses the
 *     token Platform/Asbestexperts is already sending from)
 *   - EMAIL_PROVIDER=resend   + RESEND_API_KEY   + EMAIL_FROM
 *
 * Template helpers (`inviteEmail`, `passwordResetEmail`, …) render the
 * matching React Email component in `src/emails/*.tsx` and return
 * `{ subject, text, html }`. The transport is body-type-agnostic so
 * templates can evolve (layout tweaks, brand changes) without touching
 * the dispatcher.
 *
 * Caller contract: `sendEmail` throws on delivery failure. Callers decide
 * whether to surface the error to the user or swallow it — `forgotPassword`
 * intentionally swallows to avoid email enumeration, while `createInvite`
 * currently propagates so staff see when delivery is broken.
 */

import "server-only";
import * as React from "react";
import { render } from "@react-email/render";

import Invite, {
  subject as inviteSubject,
  type InviteEmailProps,
} from "@/emails/Invite";
import ContactSubmission, {
  subject as contactSubmissionSubject,
  type ContactSubmissionEmailProps,
} from "@/emails/ContactSubmission";
import PasswordReset, {
  subject as passwordResetSubject,
  type PasswordResetEmailProps,
} from "@/emails/PasswordReset";
import MonthlyInvoiceReminder, {
  subject as monthlyInvoiceReminderSubject,
  type MonthlyInvoiceReminderEmailProps,
} from "@/emails/MonthlyInvoiceReminder";
import UserRegistered, {
  subject as userRegisteredSubject,
  type UserRegisteredEmailProps,
} from "@/emails/UserRegistered";
import EmailVerification, {
  subject as emailVerificationSubject,
  type EmailVerificationEmailProps,
} from "@/emails/EmailVerification";
import AddedToTeam, {
  subject as addedToTeamSubject,
  type AddedToTeamEmailProps,
} from "@/emails/AddedToTeam";
import AssignmentScheduled, {
  subject as assignmentScheduledSubject,
  type AssignmentScheduledEmailProps,
} from "@/emails/AssignmentScheduled";
import AssignmentDateUpdated, {
  subject as assignmentDateUpdatedSubject,
  type AssignmentDateUpdatedEmailProps,
} from "@/emails/AssignmentDateUpdated";
import AssignmentDelivered, {
  subject as assignmentDeliveredSubject,
  type AssignmentDeliveredEmailProps,
} from "@/emails/AssignmentDelivered";
import AssignmentCompleted, {
  subject as assignmentCompletedSubject,
  type AssignmentCompletedEmailProps,
} from "@/emails/AssignmentCompleted";
import AssignmentCancelled, {
  subject as assignmentCancelledSubject,
  type AssignmentCancelledEmailProps,
} from "@/emails/AssignmentCancelled";
import AssignmentReassigned, {
  subject as assignmentReassignedSubject,
  type AssignmentReassignedEmailProps,
} from "@/emails/AssignmentReassigned";
import AssignmentUnassigned, {
  subject as assignmentUnassignedSubject,
  type AssignmentUnassignedEmailProps,
} from "@/emails/AssignmentUnassigned";
import FilesUploaded, {
  subject as filesUploadedSubject,
  type FilesUploadedEmailProps,
} from "@/emails/FilesUploaded";
import CommentPosted, {
  subject as commentPostedSubject,
  type CommentPostedEmailProps,
} from "@/emails/CommentPosted";
import OdooSyncFailed, {
  subject as odooSyncFailedSubject,
  type OdooSyncFailedEmailProps,
} from "@/emails/OdooSyncFailed";

import type { AssignmentEmailCtx as _AssignmentEmailCtxFromTpl } from "@/emails/_assignment";

type SendEmailArgs = {
  to: string;
  subject: string;
  html?: string;
  text: string;
  /**
   * Optional Reply-To header. Used by the contact-form notification so an
   * admin can hit Reply in their inbox and message the visitor directly,
   * rather than replying to the no-reply@ sender.
   */
  replyTo?: string;
};

/** Shape returned by every `*Email()` template helper. */
export type RenderedEmail = { subject: string; text: string; html: string };

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const provider = (process.env.EMAIL_PROVIDER ?? "dev").toLowerCase();
  if (provider === "dev") {
    logToConsole(args);
    return;
  }
  if (provider === "postmark") {
    return sendViaPostmark(args);
  }
  if (provider === "resend") {
    return sendViaResend(args);
  }
  throw new Error(
    `Unknown EMAIL_PROVIDER "${provider}". Supported: "dev" (default), "postmark", or "resend".`,
  );
}

function logToConsole(args: SendEmailArgs): void {
  console.log("\n📧 [dev email] ──────────────────────────────");
  console.log(`To:      ${args.to}`);
  console.log(`Subject: ${args.subject}`);
  console.log("──────");
  console.log(args.text);
  console.log("─────────────────────────────────────────────\n");
}

async function sendViaPostmark(args: SendEmailArgs): Promise<void> {
  const token = process.env.POSTMARK_TOKEN;
  const from = process.env.EMAIL_FROM;
  if (!token) {
    throw new Error("POSTMARK_TOKEN is not set.");
  }
  if (!from) {
    throw new Error(
      'EMAIL_FROM is not set. Use e.g. "immoplatform <no-reply@immoplatform.be>".',
    );
  }

  const body: Record<string, unknown> = {
    From: from,
    To: args.to,
    Subject: args.subject,
    TextBody: args.text,
    MessageStream: process.env.POSTMARK_MESSAGE_STREAM ?? "outbound",
  };
  if (args.html) body.HtmlBody = args.html;
  if (args.replyTo) body.ReplyTo = args.replyTo;

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Postmark rejected the email: ${res.status} ${res.statusText} ${errText}`.trim(),
    );
  }
}

async function sendViaResend(args: SendEmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  if (!from) {
    throw new Error(
      'EMAIL_FROM is not set. Use e.g. "immoplatform <no-reply@yourdomain.com>".',
    );
  }

  const body: Record<string, unknown> = {
    from,
    to: [args.to],
    subject: args.subject,
    text: args.text,
  };
  if (args.html) body.html = args.html;
  if (args.replyTo) body.reply_to = args.replyTo;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    // Hard cap so a Resend slowdown can't stall a user's server action for
    // the full Node/Vercel request budget. notify() swallows the AbortError.
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Resend rejected the email: ${res.status} ${res.statusText} ${errText}`.trim(),
    );
  }
}

// ─── Render helpers ───────────────────────────────────────────────

/**
 * Render a React Email template into `{ html, text }`. Pretty-printing is
 * disabled so Postmark/Resend don't see extra whitespace in the payload,
 * and plain-text is derived from the same JSX so the two stay in sync.
 */
async function renderTemplate(
  element: React.ReactElement,
): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    render(element, { pretty: false }),
    render(element, { plainText: true }),
  ]);
  return { html, text };
}

// ─── Transactional templates ──────────────────────────────────────

export async function inviteEmail(
  props: InviteEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(<Invite {...props} />);
  return { subject: inviteSubject(props), html, text };
}

export async function passwordResetEmail(
  props: PasswordResetEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(<PasswordReset {...props} />);
  return { subject: passwordResetSubject(props), html, text };
}

/**
 * Monthly admin reminder — fires ~3 days before month-end to prompt whoever
 * generates invoices that the cycle is closing. Mirrors Platform's
 * MonthlyInvoiceReminder mailable. No per-invoice data; it's a nudge, not
 * a dunning notice.
 */
export async function monthlyInvoiceReminderEmail(
  props: MonthlyInvoiceReminderEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(
    <MonthlyInvoiceReminder {...props} />,
  );
  return { subject: monthlyInvoiceReminderSubject(props), html, text };
}

export async function emailVerificationEmail(
  props: EmailVerificationEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(<EmailVerification {...props} />);
  return { subject: emailVerificationSubject(props), html, text };
}

export async function userRegisteredEmail(
  props: UserRegisteredEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(<UserRegistered {...props} />);
  return { subject: userRegisteredSubject(props), html, text };
}

export async function addedToTeamEmail(
  props: AddedToTeamEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(<AddedToTeam {...props} />);
  return { subject: addedToTeamSubject(props), html, text };
}

// ─── Assignment lifecycle templates ────────────────────────────────

/** Shared context every assignment email template needs. Exported so action
 *  code can build it once and spread it into each template. */
export type AssignmentEmailCtx = _AssignmentEmailCtxFromTpl;

export async function assignmentScheduledEmail(
  props: AssignmentScheduledEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(
    <AssignmentScheduled {...props} />,
  );
  return { subject: assignmentScheduledSubject(props), html, text };
}

export async function assignmentDateUpdatedEmail(
  props: AssignmentDateUpdatedEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(
    <AssignmentDateUpdated {...props} />,
  );
  return { subject: assignmentDateUpdatedSubject(props), html, text };
}

export async function assignmentDeliveredEmail(
  props: AssignmentDeliveredEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(
    <AssignmentDelivered {...props} />,
  );
  return { subject: assignmentDeliveredSubject(props), html, text };
}

export async function assignmentCompletedEmail(
  props: AssignmentCompletedEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(
    <AssignmentCompleted {...props} />,
  );
  return { subject: assignmentCompletedSubject(props), html, text };
}

export async function assignmentCancelledEmail(
  props: AssignmentCancelledEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(
    <AssignmentCancelled {...props} />,
  );
  return { subject: assignmentCancelledSubject(props), html, text };
}

export async function assignmentReassignedEmail(
  props: AssignmentReassignedEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(
    <AssignmentReassigned {...props} />,
  );
  return { subject: assignmentReassignedSubject(props), html, text };
}

export async function assignmentUnassignedEmail(
  props: AssignmentUnassignedEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(
    <AssignmentUnassigned {...props} />,
  );
  return { subject: assignmentUnassignedSubject(props), html, text };
}

export async function filesUploadedEmail(
  props: FilesUploadedEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(<FilesUploaded {...props} />);
  return { subject: filesUploadedSubject(props), html, text };
}

export async function commentPostedEmail(
  props: CommentPostedEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(<CommentPosted {...props} />);
  return { subject: commentPostedSubject(props), html, text };
}

export async function contactSubmissionEmail(
  props: ContactSubmissionEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(<ContactSubmission {...props} />);
  return { subject: contactSubmissionSubject(props), html, text };
}

/**
 * Operational alert — Odoo sync failed for an assignment. Sent direct via
 * `sendEmail` (not `notify`) since this is a system event with a single
 * configured recipient list, not a per-user opt-out-able notification.
 * Mirrors v1's OdooSyncFailedMail.
 */
export async function odooSyncFailedEmail(
  props: OdooSyncFailedEmailProps,
): Promise<RenderedEmail> {
  const { html, text } = await renderTemplate(<OdooSyncFailed {...props} />);
  return { subject: odooSyncFailedSubject(props), html, text };
}
