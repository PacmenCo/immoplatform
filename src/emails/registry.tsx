/**
 * Server-only registry of every React Email template, each paired with
 * a default preview-props object. The preview page at `/dashboard/_emails`
 * reads from this list to render a gallery with editable props.
 *
 * Kept in `_layout`'s neighborhood (not in `lib/`) so adding a new template
 * = drop a file in `src/emails/` + add one entry here.
 *
 * Subject resolution went i18n: each template now exports
 *   subjectKey   — full ICU path like `emails.invite.subject`
 *   subjectArgs  — function returning the ICU args object for that key
 * The registry's `subject(props, t)` builds the final string by handing
 * the args to a translator scoped to the `emails` namespace, so the preview
 * page can show the localized subject without round-tripping through
 * `email.tsx`'s helpers.
 */

import "server-only";
import * as React from "react";
import IntlMessageFormat from "intl-messageformat";
import enEmails from "../../messages/en/emails.json" with { type: "json" };

import Invite, {
  subjectKey as inviteSubjectKey,
  subjectArgs as inviteSubjectArgs,
  previewProps as inviteProps,
  type InviteEmailProps,
} from "./Invite";
import PasswordReset, {
  subjectKey as passwordResetSubjectKey,
  subjectArgs as passwordResetSubjectArgs,
  previewProps as passwordResetProps,
  type PasswordResetEmailProps,
} from "./PasswordReset";
import MonthlyInvoiceReminder, {
  subjectKey as monthlyInvoiceReminderSubjectKey,
  subjectArgs as monthlyInvoiceReminderSubjectArgs,
  previewProps as monthlyInvoiceReminderProps,
  type MonthlyInvoiceReminderEmailProps,
} from "./MonthlyInvoiceReminder";
import UserRegistered, {
  subjectKey as userRegisteredSubjectKey,
  subjectArgs as userRegisteredSubjectArgs,
  previewProps as userRegisteredProps,
  type UserRegisteredEmailProps,
} from "./UserRegistered";
import EmailVerification, {
  subjectKey as emailVerificationSubjectKey,
  subjectArgs as emailVerificationSubjectArgs,
  previewProps as emailVerificationProps,
  type EmailVerificationEmailProps,
} from "./EmailVerification";
import AddedToTeam, {
  subjectKey as addedToTeamSubjectKey,
  subjectArgs as addedToTeamSubjectArgs,
  previewProps as addedToTeamProps,
  type AddedToTeamEmailProps,
} from "./AddedToTeam";
import AssignmentScheduled, {
  subjectKey as assignmentScheduledSubjectKey,
  subjectArgs as assignmentScheduledSubjectArgs,
  previewProps as assignmentScheduledProps,
  type AssignmentScheduledEmailProps,
} from "./AssignmentScheduled";
import AssignmentDateUpdated, {
  subjectKey as assignmentDateUpdatedSubjectKey,
  subjectArgs as assignmentDateUpdatedSubjectArgs,
  previewProps as assignmentDateUpdatedProps,
  type AssignmentDateUpdatedEmailProps,
} from "./AssignmentDateUpdated";
import AssignmentDelivered, {
  subjectKey as assignmentDeliveredSubjectKey,
  subjectArgs as assignmentDeliveredSubjectArgs,
  previewProps as assignmentDeliveredProps,
  type AssignmentDeliveredEmailProps,
} from "./AssignmentDelivered";
import AssignmentCompleted, {
  subjectKey as assignmentCompletedSubjectKey,
  subjectArgs as assignmentCompletedSubjectArgs,
  previewProps as assignmentCompletedProps,
  type AssignmentCompletedEmailProps,
} from "./AssignmentCompleted";
import AssignmentCancelled, {
  subjectKey as assignmentCancelledSubjectKey,
  subjectArgs as assignmentCancelledSubjectArgs,
  previewProps as assignmentCancelledProps,
  type AssignmentCancelledEmailProps,
} from "./AssignmentCancelled";
import AssignmentReassigned, {
  subjectKey as assignmentReassignedSubjectKey,
  subjectArgs as assignmentReassignedSubjectArgs,
  previewProps as assignmentReassignedProps,
  type AssignmentReassignedEmailProps,
} from "./AssignmentReassigned";
import AssignmentUnassigned, {
  subjectKey as assignmentUnassignedSubjectKey,
  subjectArgs as assignmentUnassignedSubjectArgs,
  previewProps as assignmentUnassignedProps,
  type AssignmentUnassignedEmailProps,
} from "./AssignmentUnassigned";
import FilesUploaded, {
  subjectKey as filesUploadedSubjectKey,
  subjectArgs as filesUploadedSubjectArgs,
  previewProps as filesUploadedProps,
  type FilesUploadedEmailProps,
} from "./FilesUploaded";
import CommentPosted, {
  subjectKey as commentPostedSubjectKey,
  subjectArgs as commentPostedSubjectArgs,
  previewProps as commentPostedProps,
  type CommentPostedEmailProps,
} from "./CommentPosted";
import OdooSyncFailed, {
  subjectKey as odooSyncFailedSubjectKey,
  subjectArgs as odooSyncFailedSubjectArgs,
  previewProps as odooSyncFailedProps,
  type OdooSyncFailedEmailProps,
} from "./OdooSyncFailed";

type AnyTemplate = {
  slug: string;
  label: string;
  description: string;
  element: (props: Record<string, unknown>) => React.ReactNode;
  /** Full ICU path (e.g. `emails.invite.subject`). */
  subjectKey: string;
  /** Build the ICU args object from a hydrated props object. */
  subjectArgs: (props: Record<string, unknown>) => Record<string, unknown>;
  /**
   * Sync placeholder subject — returns the bare ICU template string. The
   * preview page uses this to display *something* when it can't await a
   * translator (the route is RSC-rendered with a per-request locale; the
   * full localized subject is built server-side by `email.tsx`). For
   * production sends, the `*Email()` helpers in `lib/email.tsx` resolve
   * the catalog key through `getTranslations` instead.
   */
  subject: (props: Record<string, unknown>) => string;
  previewProps: Record<string, unknown>;
};

/**
 * Walk the EN catalog and resolve a dotted path like
 * `emails.invite.subject` to the leaf string. The `emails.` prefix is
 * stripped since `enEmails` is already that subtree. Returns the path
 * itself if the leaf is missing — keeps the preview page from crashing on
 * a typo, and the resulting "missing key" string is loud enough to spot.
 */
function lookupEnLeaf(fullKey: string): string {
  const path = fullKey.replace(/^emails\./, "").split(".");
  let cursor: unknown = enEmails;
  for (const segment of path) {
    if (cursor && typeof cursor === "object" && segment in cursor) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return fullKey;
    }
  }
  return typeof cursor === "string" ? cursor : fullKey;
}

/**
 * Format `key`'s EN value with `args`. Used as the *fallback* synchronous
 * subject builder for the dev preview page; production sends route through
 * `lib/email.tsx` which uses next-intl's locale-aware translator instead.
 */
function buildEnSubject(
  key: string,
  args: Record<string, unknown>,
): string {
  const pattern = lookupEnLeaf(key);
  try {
    return new IntlMessageFormat(pattern, "en").format(args) as string;
  } catch {
    return pattern;
  }
}

/** Pre-`subject` shape — each entry omits `subject` since we derive it
 *  from `subjectKey + subjectArgs` below. */
type TemplateInput = Omit<AnyTemplate, "subject">;

// Each template is type-erased at the catalog level so we can iterate without
// a heavyweight generic — the preview page only needs to round-trip JSON
// between the editable panel and the render call.
const TEMPLATE_INPUTS: TemplateInput[] = [
  {
    slug: "invite",
    label: "Invite",
    description:
      "Sent when an admin invites a new user. Transactional — bypasses prefs.",
    element: (p) => <Invite {...(p as InviteEmailProps)} />,
    subjectKey: inviteSubjectKey,
    subjectArgs: (p) => inviteSubjectArgs(p as InviteEmailProps),
    previewProps: inviteProps,
  },
  {
    slug: "password-reset",
    label: "Password reset",
    description: "Sent on forgot-password. Transactional.",
    element: (p) => <PasswordReset {...(p as PasswordResetEmailProps)} />,
    subjectKey: passwordResetSubjectKey,
    subjectArgs: (p) => passwordResetSubjectArgs(p as PasswordResetEmailProps),
    previewProps: passwordResetProps,
  },
  {
    slug: "email-verification",
    label: "Email verification",
    description: "Sent when a user changes their email address.",
    element: (p) => (
      <EmailVerification {...(p as EmailVerificationEmailProps)} />
    ),
    subjectKey: emailVerificationSubjectKey,
    subjectArgs: (p) =>
      emailVerificationSubjectArgs(p as EmailVerificationEmailProps),
    previewProps: emailVerificationProps,
  },
  {
    slug: "added-to-team",
    label: "Added to team",
    description: "Sent when an admin adds an existing user to a team.",
    element: (p) => <AddedToTeam {...(p as AddedToTeamEmailProps)} />,
    subjectKey: addedToTeamSubjectKey,
    subjectArgs: (p) => addedToTeamSubjectArgs(p as AddedToTeamEmailProps),
    previewProps: addedToTeamProps,
  },
  {
    slug: "monthly-invoice-reminder",
    label: "Monthly invoice reminder",
    description:
      "End-of-month nudge to generate invoices. Fires from the billing cron.",
    element: (p) => (
      <MonthlyInvoiceReminder {...(p as MonthlyInvoiceReminderEmailProps)} />
    ),
    subjectKey: monthlyInvoiceReminderSubjectKey,
    subjectArgs: (p) =>
      monthlyInvoiceReminderSubjectArgs(p as MonthlyInvoiceReminderEmailProps),
    previewProps: monthlyInvoiceReminderProps,
  },
  {
    slug: "user-registered",
    label: "User registered",
    description:
      "Sent to platform admins when someone self-registers. Honors the user.registered opt-out.",
    element: (p) => <UserRegistered {...(p as UserRegisteredEmailProps)} />,
    subjectKey: userRegisteredSubjectKey,
    subjectArgs: (p) => userRegisteredSubjectArgs(p as UserRegisteredEmailProps),
    previewProps: userRegisteredProps,
  },
  {
    slug: "assignment-scheduled",
    label: "Assignment scheduled",
    description: "Sent when an assignment lands in scheduled with a date.",
    element: (p) => (
      <AssignmentScheduled {...(p as AssignmentScheduledEmailProps)} />
    ),
    subjectKey: assignmentScheduledSubjectKey,
    subjectArgs: (p) =>
      assignmentScheduledSubjectArgs(p as AssignmentScheduledEmailProps),
    previewProps: assignmentScheduledProps,
  },
  {
    slug: "assignment-date-updated",
    label: "Assignment date updated",
    description: "Sent when the planned date of an assignment changes.",
    element: (p) => (
      <AssignmentDateUpdated {...(p as AssignmentDateUpdatedEmailProps)} />
    ),
    subjectKey: assignmentDateUpdatedSubjectKey,
    subjectArgs: (p) =>
      assignmentDateUpdatedSubjectArgs(p as AssignmentDateUpdatedEmailProps),
    previewProps: assignmentDateUpdatedProps,
  },
  {
    slug: "assignment-delivered",
    label: "Assignment delivered",
    description: "Sent to the agency when a freelancer marks work delivered.",
    element: (p) => (
      <AssignmentDelivered {...(p as AssignmentDeliveredEmailProps)} />
    ),
    subjectKey: assignmentDeliveredSubjectKey,
    subjectArgs: (p) =>
      assignmentDeliveredSubjectArgs(p as AssignmentDeliveredEmailProps),
    previewProps: assignmentDeliveredProps,
  },
  {
    slug: "assignment-completed",
    label: "Assignment completed",
    description: "Sent when an agency admin signs off on completion.",
    element: (p) => (
      <AssignmentCompleted {...(p as AssignmentCompletedEmailProps)} />
    ),
    subjectKey: assignmentCompletedSubjectKey,
    subjectArgs: (p) =>
      assignmentCompletedSubjectArgs(p as AssignmentCompletedEmailProps),
    previewProps: assignmentCompletedProps,
  },
  {
    slug: "assignment-cancelled",
    label: "Assignment cancelled",
    description: "Sent when an assignment is cancelled.",
    element: (p) => (
      <AssignmentCancelled {...(p as AssignmentCancelledEmailProps)} />
    ),
    subjectKey: assignmentCancelledSubjectKey,
    subjectArgs: (p) =>
      assignmentCancelledSubjectArgs(p as AssignmentCancelledEmailProps),
    previewProps: assignmentCancelledProps,
  },
  {
    slug: "assignment-reassigned",
    label: "Assignment reassigned",
    description: "Sent to a freelancer when they're placed on a new job.",
    element: (p) => (
      <AssignmentReassigned {...(p as AssignmentReassignedEmailProps)} />
    ),
    subjectKey: assignmentReassignedSubjectKey,
    subjectArgs: (p) =>
      assignmentReassignedSubjectArgs(p as AssignmentReassignedEmailProps),
    previewProps: assignmentReassignedProps,
  },
  {
    slug: "assignment-unassigned",
    label: "Assignment unassigned",
    description: "Sent to a freelancer when they're removed from a job.",
    element: (p) => (
      <AssignmentUnassigned {...(p as AssignmentUnassignedEmailProps)} />
    ),
    subjectKey: assignmentUnassignedSubjectKey,
    subjectArgs: (p) =>
      assignmentUnassignedSubjectArgs(p as AssignmentUnassignedEmailProps),
    previewProps: assignmentUnassignedProps,
  },
  {
    slug: "files-uploaded",
    label: "Files uploaded",
    description:
      "Sent when a freelancer or realtor uploads files on an assignment.",
    element: (p) => <FilesUploaded {...(p as FilesUploadedEmailProps)} />,
    subjectKey: filesUploadedSubjectKey,
    subjectArgs: (p) => filesUploadedSubjectArgs(p as FilesUploadedEmailProps),
    previewProps: filesUploadedProps,
  },
  {
    slug: "comment-posted",
    label: "Comment posted",
    description: "Sent when someone comments on an assignment thread.",
    element: (p) => <CommentPosted {...(p as CommentPostedEmailProps)} />,
    subjectKey: commentPostedSubjectKey,
    subjectArgs: (p) => commentPostedSubjectArgs(p as CommentPostedEmailProps),
    previewProps: commentPostedProps,
  },
  {
    slug: "odoo-sync-failed",
    label: "Odoo sync failed",
    description:
      "Operational alert when Odoo synchronization for an assignment fails. Sent to ODOO_SYNC_FAILURE_EMAIL.",
    element: (p) => <OdooSyncFailed {...(p as OdooSyncFailedEmailProps)} />,
    subjectKey: odooSyncFailedSubjectKey,
    subjectArgs: (p) => odooSyncFailedSubjectArgs(p as OdooSyncFailedEmailProps),
    previewProps: odooSyncFailedProps,
  },
];

/**
 * Public registry — same shape as before plus the synthesized `subject`
 * helper for backward-compat with the dev preview page. Production sends
 * skip this and route through the locale-aware helpers in `lib/email.tsx`.
 */
export const EMAIL_TEMPLATES: AnyTemplate[] = TEMPLATE_INPUTS.map((t) => ({
  ...t,
  subject: (props) => buildEnSubject(t.subjectKey, t.subjectArgs(props)),
}));

export function findTemplate(slug: string): AnyTemplate | undefined {
  return EMAIL_TEMPLATES.find((t) => t.slug === slug);
}

/**
 * Rebuild a props object from JSON, re-hydrating Date-like ISO strings back
 * to Date objects. We detect dates by looking at the reference
 * `previewProps` — any field that's a Date there is treated as a Date when
 * deserialized.
 */
export function hydratePropsFromJson(
  slug: string,
  json: Record<string, unknown>,
): Record<string, unknown> {
  const tpl = findTemplate(slug);
  if (!tpl) return json;
  const out: Record<string, unknown> = { ...json };
  for (const [key, refValue] of Object.entries(tpl.previewProps)) {
    if (refValue instanceof Date && typeof json[key] === "string") {
      const parsed = new Date(json[key] as string);
      if (!Number.isNaN(parsed.getTime())) out[key] = parsed;
    }
  }
  return out;
}
