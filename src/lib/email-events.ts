/**
 * Catalog of user-opt-outable email events.
 *
 * Keys follow the `object.action` convention (matches audit verbs where
 * applicable). A user's `emailPrefs` JSON column stores `{ [eventKey]: false }`
 * for disabled events; absent key or absent column means default-enabled.
 *
 * Forced / transactional events (invite, password reset, added-to-team)
 * deliberately bypass this catalog — those always send.
 *
 * Each event also carries a `category` so the settings UI can group events
 * into sections. Categories and their order mirror Platform's Livewire
 * EmailPreferences component: assignments → team → user → system.
 */

import type { Role } from "./permissions";

/**
 * Display groups for the preferences UI. Order here is render order —
 * matches Platform's `ORDER BY CASE … opdrachten/kantoren/gebruikers/overig`.
 */
export const EMAIL_CATEGORIES = [
  {
    key: "assignment",
    label: "Assignments",
    description: "Emails about the jobs you're involved in.",
  },
  {
    key: "team",
    label: "Teams & offices",
    description: "Emails about your team and its members.",
  },
  {
    key: "user",
    label: "Your account",
    description: "Emails about your own account activity.",
  },
  {
    key: "system",
    label: "System",
    description: "Operational and platform-level emails — admin only.",
  },
] as const;

export type EmailCategoryKey = (typeof EMAIL_CATEGORIES)[number]["key"];

type EmailEventDefinition = {
  label: string;
  description: string;
  forRoles: readonly Role[];
  category: EmailCategoryKey;
};

export const EMAIL_EVENTS = {
  "assignment.scheduled": {
    label: "When one of my assignments is scheduled with a date",
    description:
      "Sent to the realtor and agency when a new assignment lands in the scheduled state with a preferred date. Platform parity: AssignmentScheduledMail.",
    forRoles: ["realtor", "admin", "staff"] as const,
    category: "assignment",
  },
  "assignment.date_updated": {
    label: "When an assignment's scheduled date changes",
    description: "Sent to the freelancer + creator when the preferred date is edited.",
    forRoles: ["freelancer", "realtor", "admin", "staff"] as const,
    category: "assignment",
  },
  "assignment.freelancer_assigned": {
    label: "When I'm placed on a new assignment (or reassigned)",
    description: "Sent to the freelancer on first assignment and on any reassignment.",
    forRoles: ["freelancer"] as const,
    category: "assignment",
  },
  "assignment.freelancer_unassigned": {
    label: "When I'm removed from an assignment",
    description: "Sent to the freelancer when the agency reassigns their work to someone else.",
    forRoles: ["freelancer"] as const,
    category: "assignment",
  },
  "assignment.delivered": {
    label: "When my team's assignment is delivered",
    description: "Sent to the agency when the freelancer flags the work delivered.",
    forRoles: ["realtor", "admin", "staff"] as const,
    category: "assignment",
  },
  "assignment.completed": {
    label: "When an assignment I'm on is marked completed",
    description: "Sent to the assigned freelancer when the agency signs off.",
    forRoles: ["freelancer", "realtor", "admin", "staff"] as const,
    category: "assignment",
  },
  "assignment.cancelled": {
    label: "When an assignment I'm on is cancelled",
    description: "Sent to the freelancer (if assigned) and the creator.",
    forRoles: ["freelancer", "realtor", "admin", "staff"] as const,
    category: "assignment",
  },
  "assignment.files_uploaded": {
    label: "When files are uploaded to an assignment I'm on",
    description:
      "Sent to the realtor / creator when the freelancer uploads deliverables, and to the freelancer when the realtor uploads supporting docs.",
    forRoles: ["freelancer", "realtor", "admin", "staff"] as const,
    category: "assignment",
  },
  "assignment.comment_posted": {
    label: "When someone comments on an assignment I'm on",
    description: "Sent to other participants on the thread — commenter is excluded.",
    forRoles: ["freelancer", "realtor", "admin", "staff"] as const,
    category: "assignment",
  },
  "team.member_added": {
    label: "When a new member joins my team",
    description:
      "Sent to existing team admins when someone new accepts an invite or is added to the office. Platform parity: team_member_added.",
    forRoles: ["admin", "realtor"] as const,
    category: "team",
  },
  "user.registered": {
    label: "When a new user registers on the platform",
    description:
      "Sent to platform admins when someone completes sign-up. Platform parity: user_registered.",
    forRoles: ["admin"] as const,
    category: "user",
  },
  "billing.monthly_invoice_reminder": {
    label: "Monthly invoice reminder",
    description:
      "End-of-month nudge to generate invoices for completed work. Fires from the billing cron. Platform parity: MonthlyInvoiceReminder.",
    forRoles: ["admin", "staff"] as const,
    category: "system",
  },
  "system.odoo_sync_failed": {
    label: "When an Odoo sync fails",
    description:
      "Sent when an assignment fails to sync to Odoo so someone can resolve it. Platform parity: OdooSyncFailedMail.",
    forRoles: ["admin"] as const,
    category: "system",
  },
  "system.error": {
    label: "Critical system errors",
    description:
      "Sent to admins on unrecoverable backend errors. Platform parity: system_error.",
    forRoles: ["admin"] as const,
    category: "system",
  },
} as const satisfies Record<string, EmailEventDefinition>;

export type EmailEventKey = keyof typeof EMAIL_EVENTS;

/** Events a given role can opt into. Used to render the prefs UI. */
export function eventsForRole(role: Role): EmailEventKey[] {
  return (Object.keys(EMAIL_EVENTS) as EmailEventKey[]).filter((k) =>
    (EMAIL_EVENTS[k].forRoles as readonly string[]).includes(role),
  );
}

/**
 * True if this user wants to receive notifications for the given event.
 * Defaults to true when the prefs JSON is absent, unparseable, or missing
 * this key — opt-out model, not opt-in.
 */
export function shouldSendEmail(
  user: { emailPrefs: string | null },
  event: EmailEventKey,
): boolean {
  if (!user.emailPrefs) return true;
  try {
    const prefs = JSON.parse(user.emailPrefs) as Record<string, unknown>;
    return prefs[event] !== false;
  } catch {
    return true;
  }
}
