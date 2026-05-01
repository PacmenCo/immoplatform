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
// `IntlProvider` is loaded via dynamic import inside `renderTemplate()` so it
// never appears in the static module graph. Earlier we tried two static
// approaches and both broke a real flow:
//   - `IntlProvider` from `use-intl/react`: pulls `createContext` into the
//     RSC bundle, crashing any server component that transitively imports
//     this file (e.g. dashboard pages → server actions → email).
//   - `NextIntlClientProvider` from `next-intl`: marked with "use client",
//     so `@react-email/render` (running server-side) can't invoke it as
//     a function — comment-submit / invite-send / etc. all 500'd.
// Dynamic import sidesteps both: the client-context module is only resolved
// inside the render() call path, never at import time.
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

import Invite, {
  subjectKey as inviteSubjectKey,
  subjectArgs as inviteSubjectArgs,
  type InviteEmailProps,
} from "@/emails/Invite";
import ContactSubmission, {
  subjectKey as contactSubmissionSubjectKey,
  subjectArgs as contactSubmissionSubjectArgs,
  type ContactSubmissionEmailProps,
} from "@/emails/ContactSubmission";
import PasswordReset, {
  subjectKey as passwordResetSubjectKey,
  subjectArgs as passwordResetSubjectArgs,
  type PasswordResetEmailProps,
} from "@/emails/PasswordReset";
import MonthlyInvoiceReminder, {
  subjectKey as monthlyInvoiceReminderSubjectKey,
  subjectArgs as monthlyInvoiceReminderSubjectArgs,
  type MonthlyInvoiceReminderEmailProps,
} from "@/emails/MonthlyInvoiceReminder";
import UserRegistered, {
  subjectKey as userRegisteredSubjectKey,
  subjectArgs as userRegisteredSubjectArgs,
  type UserRegisteredEmailProps,
} from "@/emails/UserRegistered";
import EmailVerification, {
  subjectKey as emailVerificationSubjectKey,
  subjectArgs as emailVerificationSubjectArgs,
  type EmailVerificationEmailProps,
} from "@/emails/EmailVerification";
import AddedToTeam, {
  subjectKey as addedToTeamSubjectKey,
  subjectArgs as addedToTeamSubjectArgs,
  type AddedToTeamEmailProps,
} from "@/emails/AddedToTeam";
import AssignmentScheduled, {
  subjectKey as assignmentScheduledSubjectKey,
  subjectArgs as assignmentScheduledSubjectArgs,
  type AssignmentScheduledEmailProps,
} from "@/emails/AssignmentScheduled";
import AssignmentDateUpdated, {
  subjectKey as assignmentDateUpdatedSubjectKey,
  subjectArgs as assignmentDateUpdatedSubjectArgs,
  type AssignmentDateUpdatedEmailProps,
} from "@/emails/AssignmentDateUpdated";
import AssignmentCompleted, {
  subjectKey as assignmentCompletedSubjectKey,
  subjectArgs as assignmentCompletedSubjectArgs,
  type AssignmentCompletedEmailProps,
} from "@/emails/AssignmentCompleted";
import AssignmentCancelled, {
  subjectKey as assignmentCancelledSubjectKey,
  subjectArgs as assignmentCancelledSubjectArgs,
  type AssignmentCancelledEmailProps,
} from "@/emails/AssignmentCancelled";
import AssignmentReassigned, {
  subjectKey as assignmentReassignedSubjectKey,
  subjectArgs as assignmentReassignedSubjectArgs,
  type AssignmentReassignedEmailProps,
} from "@/emails/AssignmentReassigned";
import AssignmentUnassigned, {
  subjectKey as assignmentUnassignedSubjectKey,
  subjectArgs as assignmentUnassignedSubjectArgs,
  type AssignmentUnassignedEmailProps,
} from "@/emails/AssignmentUnassigned";
import FilesUploaded, {
  subjectKey as filesUploadedSubjectKey,
  subjectArgs as filesUploadedSubjectArgs,
  type FilesUploadedEmailProps,
} from "@/emails/FilesUploaded";
import CommentPosted, {
  subjectKey as commentPostedSubjectKey,
  subjectArgs as commentPostedSubjectArgs,
  type CommentPostedEmailProps,
} from "@/emails/CommentPosted";
import OdooSyncFailed, {
  subjectKey as odooSyncFailedSubjectKey,
  subjectArgs as odooSyncFailedSubjectArgs,
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
  /**
   * BCP-47 locale for the recipient (`en` | `nl-BE`). Drives the language
   * of every translated string in the rendered template + subject.
   * Optional — falls back to `routing.defaultLocale` when omitted (admin
   * fan-outs, cron, system alerts where there's no per-recipient locale).
   *
   * Note: by the time the dispatcher runs, the rendered `subject` / `text` /
   * `html` are already locale-baked. This field is here for parity with
   * template helpers + future provider switches that may want to set a
   * language tag on the outgoing message envelope.
   */
  locale?: string;
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

/**
 * Resolve a usable locale string. Caller-supplied values are validated
 * against the routing config; anything else (`undefined`, an unknown tag)
 * falls back to the routing default. Centralised here so every template
 * helper picks the same default and we don't sprinkle `?? "nl-BE"` strings
 * across the codebase.
 */
function resolveLocale(locale: string | undefined): string {
  if (!locale) return routing.defaultLocale;
  return (routing.locales as readonly string[]).includes(locale)
    ? locale
    : routing.defaultLocale;
}

/**
 * Pick a translator scoped to a single email namespace. Uses next-intl's
 * out-of-request `getTranslations({ locale, namespace })` overload — works
 * fine outside a request scope (cron, admin fan-out) because we pass the
 * locale explicitly rather than relying on `getRequestConfig`.
 */
async function translatorFor(
  locale: string,
  namespace: string,
): Promise<(key: string, args?: Record<string, unknown>) => string> {
  // The `namespace` arg accepts any nested key path; we cast through `any`
  // to escape the `Messages` generic constraint that `getTranslations`
  // exposes (it's typed against the live messages tree, but here we only
  // know the namespace at call site).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = await (getTranslations as any)({ locale, namespace });
  return (key: string, args?: Record<string, unknown>) =>
    args ? (t as (k: string, a: Record<string, unknown>) => string)(key, args) : (t as (k: string) => string)(key);
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
 * Load the `emails` namespace tree for a given locale. We import the JSON
 * directly (not via next-intl's request scope) so this works inside cron
 * jobs and out-of-request system alerts. The full `emails.*` subtree is
 * what every template's `useTranslations("emails.<name>")` resolves
 * against, so we drop it under that namespace prefix when handing it to
 * `IntlProvider`.
 */
async function loadEmailMessages(
  locale: string,
): Promise<Record<string, unknown>> {
  const mod = (await import(`../../messages/${locale}/emails.json`)) as {
    default: Record<string, unknown>;
  };
  return { emails: mod.default };
}

/**
 * Render a React Email template into `{ html, text }`. Pretty-printing is
 * disabled so Postmark/Resend don't see extra whitespace in the payload,
 * and plain-text is derived from the same JSX so the two stay in sync.
 *
 * The element is wrapped in `NextIntlClientProvider` so any
 * `useTranslations()` calls inside the template tree resolve against the
 * recipient's locale instead of falling through to next-intl's
 * request-scoped config (which doesn't exist for cron / system emails).
 *
 * We use `NextIntlClientProvider` (not the lower-level `IntlProvider` from
 * `use-intl/react`) because next-intl marks its provider with the proper
 * "use client" boundary directive — importing the bare `use-intl/react`
 * IntlProvider here would pull `createContext` into the RSC bundle and
 * crash any server-component route that transitively imports `email.tsx`
 * via a server action.
 */
async function renderTemplate(
  element: React.ReactElement,
  locale: string,
): Promise<{ html: string; text: string }> {
  const messages = await loadEmailMessages(locale);
  // Dynamic import keeps `IntlProvider`'s React-context dependency out of the
  // static module graph (see top-of-file note). `use-intl/react`'s provider
  // is the right tool here: framework-agnostic, plain React-context, and
  // the email render runs in a render-tree context where context propagates.
  const { IntlProvider } = await import("use-intl/react");
  const wrapped = (
    <IntlProvider
      locale={locale as Parameters<typeof IntlProvider>[0]["locale"]}
      messages={messages as Parameters<typeof IntlProvider>[0]["messages"]}
    >
      {element}
    </IntlProvider>
  );
  const [html, text] = await Promise.all([
    render(wrapped, { pretty: false }),
    render(wrapped, { plainText: true }),
  ]);
  return { html, text };
}

// ─── Transactional templates ──────────────────────────────────────
//
// Every helper accepts an optional `locale` arg. Falls back to
// `routing.defaultLocale` (currently `nl-BE`) for system emails / cron /
// admin fan-outs where there's no per-recipient locale. The helper:
//   1. resolves the locale (validates against routing)
//   2. fetches an `emails.<template>` translator for the subject
//   3. renders the React tree wrapped in an IntlProvider so the
//      `useTranslations()` calls inside the template resolve correctly

async function buildSubject(
  locale: string,
  fullKey: string,
  args: Record<string, unknown>,
): Promise<string> {
  // `fullKey` is shaped like `emails.invite.subject` — split into namespace
  // + leaf so `getTranslations({ namespace })` returns a translator scoped
  // close to the leaf for parity with the body's `useTranslations` scope.
  const dot = fullKey.lastIndexOf(".");
  const namespace = fullKey.slice(0, dot);
  const leaf = fullKey.slice(dot + 1);
  const t = await translatorFor(locale, namespace);
  return t(leaf, args);
}

export async function inviteEmail(
  props: InviteEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(<Invite {...props} />, lc);
  const subject = await buildSubject(lc, inviteSubjectKey, inviteSubjectArgs(props));
  return { subject, html, text };
}

export async function passwordResetEmail(
  props: PasswordResetEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(<PasswordReset {...props} />, lc);
  const subject = await buildSubject(
    lc,
    passwordResetSubjectKey,
    passwordResetSubjectArgs(props),
  );
  return { subject, html, text };
}

/**
 * Monthly admin reminder — fires ~3 days before month-end to prompt whoever
 * generates invoices that the cycle is closing. Mirrors Platform's
 * MonthlyInvoiceReminder mailable. No per-invoice data; it's a nudge, not
 * a dunning notice.
 */
export async function monthlyInvoiceReminderEmail(
  props: MonthlyInvoiceReminderEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(
    <MonthlyInvoiceReminder {...props} />,
    lc,
  );
  const subject = await buildSubject(
    lc,
    monthlyInvoiceReminderSubjectKey,
    monthlyInvoiceReminderSubjectArgs(props),
  );
  return { subject, html, text };
}

export async function emailVerificationEmail(
  props: EmailVerificationEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(<EmailVerification {...props} />, lc);
  const subject = await buildSubject(
    lc,
    emailVerificationSubjectKey,
    emailVerificationSubjectArgs(props),
  );
  return { subject, html, text };
}

export async function userRegisteredEmail(
  props: UserRegisteredEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(<UserRegistered {...props} />, lc);
  const subject = await buildSubject(
    lc,
    userRegisteredSubjectKey,
    userRegisteredSubjectArgs(props),
  );
  return { subject, html, text };
}

export async function addedToTeamEmail(
  props: AddedToTeamEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(<AddedToTeam {...props} />, lc);
  const subject = await buildSubject(
    lc,
    addedToTeamSubjectKey,
    addedToTeamSubjectArgs(props),
  );
  return { subject, html, text };
}

// ─── Assignment lifecycle templates ────────────────────────────────

/** Shared context every assignment email template needs. Exported so action
 *  code can build it once and spread it into each template. */
export type AssignmentEmailCtx = _AssignmentEmailCtxFromTpl;

export async function assignmentScheduledEmail(
  props: AssignmentScheduledEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(
    <AssignmentScheduled {...props} />,
    lc,
  );
  const subject = await buildSubject(
    lc,
    assignmentScheduledSubjectKey,
    assignmentScheduledSubjectArgs(props),
  );
  return { subject, html, text };
}

export async function assignmentDateUpdatedEmail(
  props: AssignmentDateUpdatedEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(
    <AssignmentDateUpdated {...props} />,
    lc,
  );
  const subject = await buildSubject(
    lc,
    assignmentDateUpdatedSubjectKey,
    assignmentDateUpdatedSubjectArgs(props),
  );
  return { subject, html, text };
}

export async function assignmentCompletedEmail(
  props: AssignmentCompletedEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(
    <AssignmentCompleted {...props} />,
    lc,
  );
  const subject = await buildSubject(
    lc,
    assignmentCompletedSubjectKey,
    assignmentCompletedSubjectArgs(props),
  );
  return { subject, html, text };
}

export async function assignmentCancelledEmail(
  props: AssignmentCancelledEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(
    <AssignmentCancelled {...props} />,
    lc,
  );
  const subject = await buildSubject(
    lc,
    assignmentCancelledSubjectKey,
    assignmentCancelledSubjectArgs(props),
  );
  return { subject, html, text };
}

export async function assignmentReassignedEmail(
  props: AssignmentReassignedEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(
    <AssignmentReassigned {...props} />,
    lc,
  );
  const subject = await buildSubject(
    lc,
    assignmentReassignedSubjectKey,
    assignmentReassignedSubjectArgs(props),
  );
  return { subject, html, text };
}

export async function assignmentUnassignedEmail(
  props: AssignmentUnassignedEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(
    <AssignmentUnassigned {...props} />,
    lc,
  );
  const subject = await buildSubject(
    lc,
    assignmentUnassignedSubjectKey,
    assignmentUnassignedSubjectArgs(props),
  );
  return { subject, html, text };
}

export async function filesUploadedEmail(
  props: FilesUploadedEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(<FilesUploaded {...props} />, lc);
  const subject = await buildSubject(
    lc,
    filesUploadedSubjectKey,
    filesUploadedSubjectArgs(props),
  );
  return { subject, html, text };
}

export async function commentPostedEmail(
  props: CommentPostedEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(<CommentPosted {...props} />, lc);
  const subject = await buildSubject(
    lc,
    commentPostedSubjectKey,
    commentPostedSubjectArgs(props),
  );
  return { subject, html, text };
}

export async function contactSubmissionEmail(
  props: ContactSubmissionEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(<ContactSubmission {...props} />, lc);
  const subject = await buildSubject(
    lc,
    contactSubmissionSubjectKey,
    contactSubmissionSubjectArgs(props),
  );
  return { subject, html, text };
}

/**
 * Operational alert — Odoo sync failed for an assignment. Sent direct via
 * `sendEmail` (not `notify`) since this is a system event with a single
 * configured recipient list, not a per-user opt-out-able notification.
 * Mirrors v1's OdooSyncFailedMail.
 */
export async function odooSyncFailedEmail(
  props: OdooSyncFailedEmailProps,
  locale?: string,
): Promise<RenderedEmail> {
  const lc = resolveLocale(locale);
  const { html, text } = await renderTemplate(<OdooSyncFailed {...props} />, lc);
  const subject = await buildSubject(
    lc,
    odooSyncFailedSubjectKey,
    odooSyncFailedSubjectArgs(props),
  );
  return { subject, html, text };
}
