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
  // "system" category was removed alongside the three system.* events
  // (invoice-reminder, odoo_sync_failed, error) — none had a real per-user
  // gate. Re-add when there's a system event with notify()-driven fan-out.
] as const;

export type EmailCategoryKey = (typeof EMAIL_CATEGORIES)[number]["key"];

type EmailEventDefinition = {
  label: string;
  description: string;
  forRoles: readonly Role[];
  category: EmailCategoryKey;
};

export const EMAIL_EVENTS = {
  "assignment.created": {
    label: "When a new assignment is created",
    description:
      "Sent to platform admins + staff when any new assignment lands. Platform parity: NewAssignmentMail — v1 fans every create out to all admins so triage doesn't rely on someone watching the dashboard.",
    forRoles: ["admin", "staff"] as const,
    category: "assignment",
  },
  "assignment.scheduled": {
    label: "When one of my assignments is scheduled with a date",
    description:
      "Sent to the realtor and agency when a new assignment lands in the scheduled state with a planned date. Platform parity: AssignmentScheduledMail.",
    forRoles: ["realtor", "admin", "staff"] as const,
    category: "assignment",
  },
  "assignment.date_updated": {
    label: "When an assignment's scheduled date changes",
    description: "Sent to the freelancer + creator when the planned date is edited.",
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
    label: "When I'm added to a team",
    description:
      "Sent to you when an admin or realtor adds you to one of their teams. Doesn't fire on first-time invite acceptance — that path uses the invite email instead. Freelancers are platform-global and never team members, so this toggle is hidden for them.",
    forRoles: ["admin", "staff", "realtor"] as const,
    category: "team",
  },
  "user.registered": {
    label: "When a new user registers on the platform",
    description:
      "Sent to platform admins when someone completes sign-up. Platform parity: user_registered.",
    forRoles: ["admin"] as const,
    category: "user",
  },
  // Removed (decorative toggles with no per-user gate):
  //   billing.monthly_invoice_reminder — fires from cron to a single
  //     INVOICE_REMINDER_EMAIL env address, not per-user. Same pattern v1
  //     uses; the toggle was theatre.
  //   system.odoo_sync_failed — no template, no sender wired in v2. v1
  //     hardcodes recipient.
  //   system.error — no template, no sender. Pure UI placeholder.
  // If/when any of these gain a real per-user fan-out (notify() to all
  // admins) re-add the entry and wire the gate at the call site.
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
  user: { emailPrefs: unknown },
  event: EmailEventKey,
): boolean {
  const raw = user.emailPrefs;
  if (!raw) return true;
  // Platform parity — the column is stored as JSONB on Postgres and comes
  // back already-parsed. For test DBs / legacy rows that seeded a string,
  // we still try `JSON.parse` as a fallback. Fail open.
  let prefs: Record<string, unknown> | null = null;
  if (typeof raw === "string") {
    try {
      prefs = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return true;
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    prefs = raw as Record<string, unknown>;
  }
  if (!prefs) return true;
  return prefs[event] !== false;
}
