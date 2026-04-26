/**
 * Server-only registry of every React Email template, each paired with
 * a default preview-props object. The preview page at `/dashboard/_emails`
 * reads from this list to render a gallery with editable props.
 *
 * Kept in `_layout`'s neighborhood (not in `lib/`) so adding a new template
 * = drop a file in `src/emails/` + add one entry here.
 */

import "server-only";
import * as React from "react";

import Invite, {
  subject as inviteSubject,
  previewProps as inviteProps,
  type InviteEmailProps,
} from "./Invite";
import PasswordReset, {
  subject as passwordResetSubject,
  previewProps as passwordResetProps,
  type PasswordResetEmailProps,
} from "./PasswordReset";
import MonthlyInvoiceReminder, {
  subject as monthlyInvoiceReminderSubject,
  previewProps as monthlyInvoiceReminderProps,
  type MonthlyInvoiceReminderEmailProps,
} from "./MonthlyInvoiceReminder";
import UserRegistered, {
  subject as userRegisteredSubject,
  previewProps as userRegisteredProps,
  type UserRegisteredEmailProps,
} from "./UserRegistered";
import EmailVerification, {
  subject as emailVerificationSubject,
  previewProps as emailVerificationProps,
  type EmailVerificationEmailProps,
} from "./EmailVerification";
import AddedToTeam, {
  subject as addedToTeamSubject,
  previewProps as addedToTeamProps,
  type AddedToTeamEmailProps,
} from "./AddedToTeam";
import AssignmentScheduled, {
  subject as assignmentScheduledSubject,
  previewProps as assignmentScheduledProps,
  type AssignmentScheduledEmailProps,
} from "./AssignmentScheduled";
import AssignmentDateUpdated, {
  subject as assignmentDateUpdatedSubject,
  previewProps as assignmentDateUpdatedProps,
  type AssignmentDateUpdatedEmailProps,
} from "./AssignmentDateUpdated";
import AssignmentDelivered, {
  subject as assignmentDeliveredSubject,
  previewProps as assignmentDeliveredProps,
  type AssignmentDeliveredEmailProps,
} from "./AssignmentDelivered";
import AssignmentCompleted, {
  subject as assignmentCompletedSubject,
  previewProps as assignmentCompletedProps,
  type AssignmentCompletedEmailProps,
} from "./AssignmentCompleted";
import AssignmentCancelled, {
  subject as assignmentCancelledSubject,
  previewProps as assignmentCancelledProps,
  type AssignmentCancelledEmailProps,
} from "./AssignmentCancelled";
import AssignmentReassigned, {
  subject as assignmentReassignedSubject,
  previewProps as assignmentReassignedProps,
  type AssignmentReassignedEmailProps,
} from "./AssignmentReassigned";
import AssignmentUnassigned, {
  subject as assignmentUnassignedSubject,
  previewProps as assignmentUnassignedProps,
  type AssignmentUnassignedEmailProps,
} from "./AssignmentUnassigned";
import FilesUploaded, {
  subject as filesUploadedSubject,
  previewProps as filesUploadedProps,
  type FilesUploadedEmailProps,
} from "./FilesUploaded";
import CommentPosted, {
  subject as commentPostedSubject,
  previewProps as commentPostedProps,
  type CommentPostedEmailProps,
} from "./CommentPosted";

type AnyTemplate = {
  slug: string;
  label: string;
  description: string;
  element: (props: Record<string, unknown>) => React.ReactNode;
  subject: (props: Record<string, unknown>) => string;
  previewProps: Record<string, unknown>;
};

// Each template is type-erased at the catalog level so we can iterate without
// a heavyweight generic — the preview page only needs to round-trip JSON
// between the editable panel and the render call.
export const EMAIL_TEMPLATES: AnyTemplate[] = [
  {
    slug: "invite",
    label: "Invite",
    description:
      "Sent when an admin invites a new user. Transactional — bypasses prefs.",
    element: (p) => <Invite {...(p as InviteEmailProps)} />,
    subject: (p) => inviteSubject(p as InviteEmailProps),
    previewProps: inviteProps,
  },
  {
    slug: "password-reset",
    label: "Password reset",
    description: "Sent on forgot-password. Transactional.",
    element: (p) => <PasswordReset {...(p as PasswordResetEmailProps)} />,
    subject: (p) => passwordResetSubject(p as PasswordResetEmailProps),
    previewProps: passwordResetProps,
  },
  {
    slug: "email-verification",
    label: "Email verification",
    description: "Sent when a user changes their email address.",
    element: (p) => (
      <EmailVerification {...(p as EmailVerificationEmailProps)} />
    ),
    subject: (p) => emailVerificationSubject(p as EmailVerificationEmailProps),
    previewProps: emailVerificationProps,
  },
  {
    slug: "added-to-team",
    label: "Added to team",
    description: "Sent when an admin adds an existing user to a team.",
    element: (p) => <AddedToTeam {...(p as AddedToTeamEmailProps)} />,
    subject: (p) => addedToTeamSubject(p as AddedToTeamEmailProps),
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
    subject: (p) =>
      monthlyInvoiceReminderSubject(p as MonthlyInvoiceReminderEmailProps),
    previewProps: monthlyInvoiceReminderProps,
  },
  {
    slug: "user-registered",
    label: "User registered",
    description:
      "Sent to platform admins when someone self-registers. Honors the user.registered opt-out.",
    element: (p) => <UserRegistered {...(p as UserRegisteredEmailProps)} />,
    subject: (p) => userRegisteredSubject(p as UserRegisteredEmailProps),
    previewProps: userRegisteredProps,
  },
  {
    slug: "assignment-scheduled",
    label: "Assignment scheduled",
    description: "Sent when an assignment lands in scheduled with a date.",
    element: (p) => (
      <AssignmentScheduled {...(p as AssignmentScheduledEmailProps)} />
    ),
    subject: (p) =>
      assignmentScheduledSubject(p as AssignmentScheduledEmailProps),
    previewProps: assignmentScheduledProps,
  },
  {
    slug: "assignment-date-updated",
    label: "Assignment date updated",
    description: "Sent when the preferred date of an assignment changes.",
    element: (p) => (
      <AssignmentDateUpdated {...(p as AssignmentDateUpdatedEmailProps)} />
    ),
    subject: (p) =>
      assignmentDateUpdatedSubject(p as AssignmentDateUpdatedEmailProps),
    previewProps: assignmentDateUpdatedProps,
  },
  {
    slug: "assignment-delivered",
    label: "Assignment delivered",
    description: "Sent to the agency when a freelancer marks work delivered.",
    element: (p) => (
      <AssignmentDelivered {...(p as AssignmentDeliveredEmailProps)} />
    ),
    subject: (p) =>
      assignmentDeliveredSubject(p as AssignmentDeliveredEmailProps),
    previewProps: assignmentDeliveredProps,
  },
  {
    slug: "assignment-completed",
    label: "Assignment completed",
    description: "Sent when an agency admin signs off on completion.",
    element: (p) => (
      <AssignmentCompleted {...(p as AssignmentCompletedEmailProps)} />
    ),
    subject: (p) =>
      assignmentCompletedSubject(p as AssignmentCompletedEmailProps),
    previewProps: assignmentCompletedProps,
  },
  {
    slug: "assignment-cancelled",
    label: "Assignment cancelled",
    description: "Sent when an assignment is cancelled.",
    element: (p) => (
      <AssignmentCancelled {...(p as AssignmentCancelledEmailProps)} />
    ),
    subject: (p) =>
      assignmentCancelledSubject(p as AssignmentCancelledEmailProps),
    previewProps: assignmentCancelledProps,
  },
  {
    slug: "assignment-reassigned",
    label: "Assignment reassigned",
    description: "Sent to a freelancer when they're placed on a new job.",
    element: (p) => (
      <AssignmentReassigned {...(p as AssignmentReassignedEmailProps)} />
    ),
    subject: (p) =>
      assignmentReassignedSubject(p as AssignmentReassignedEmailProps),
    previewProps: assignmentReassignedProps,
  },
  {
    slug: "assignment-unassigned",
    label: "Assignment unassigned",
    description: "Sent to a freelancer when they're removed from a job.",
    element: (p) => (
      <AssignmentUnassigned {...(p as AssignmentUnassignedEmailProps)} />
    ),
    subject: (p) =>
      assignmentUnassignedSubject(p as AssignmentUnassignedEmailProps),
    previewProps: assignmentUnassignedProps,
  },
  {
    slug: "files-uploaded",
    label: "Files uploaded",
    description:
      "Sent when a freelancer or realtor uploads files on an assignment.",
    element: (p) => <FilesUploaded {...(p as FilesUploadedEmailProps)} />,
    subject: (p) => filesUploadedSubject(p as FilesUploadedEmailProps),
    previewProps: filesUploadedProps,
  },
  {
    slug: "comment-posted",
    label: "Comment posted",
    description: "Sent when someone comments on an assignment thread.",
    element: (p) => <CommentPosted {...(p as CommentPostedEmailProps)} />,
    subject: (p) => commentPostedSubject(p as CommentPostedEmailProps),
    previewProps: commentPostedProps,
  },
];

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
