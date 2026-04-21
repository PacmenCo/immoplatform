/**
 * Catalog of user-opt-outable email events.
 *
 * Keys follow the `object.action` convention (matches audit verbs where
 * applicable). A user's `emailPrefs` JSON column stores `{ [eventKey]: false }`
 * for disabled events; absent key or absent column means default-enabled.
 *
 * Forced / transactional events (invite, password reset, added-to-team)
 * deliberately bypass this catalog — those always send.
 */

import type { Role } from "./permissions";

export const EMAIL_EVENTS = {
  "assignment.date_updated": {
    label: "When an assignment's scheduled date changes",
    description: "Sent to the freelancer + creator when the preferred date is edited.",
    forRoles: ["freelancer", "realtor", "admin", "staff"] as const,
  },
  "assignment.freelancer_assigned": {
    label: "When I'm placed on a new assignment (or reassigned)",
    description: "Sent to the freelancer on first assignment and on any reassignment.",
    forRoles: ["freelancer"] as const,
  },
  "assignment.freelancer_unassigned": {
    label: "When I'm removed from an assignment",
    description: "Sent to the freelancer when the agency reassigns their work to someone else.",
    forRoles: ["freelancer"] as const,
  },
  "assignment.delivered": {
    label: "When my team's assignment is delivered",
    description: "Sent to the agency when the freelancer flags the work delivered.",
    forRoles: ["realtor", "admin", "staff"] as const,
  },
  "assignment.completed": {
    label: "When an assignment I'm on is marked completed",
    description: "Sent to the assigned freelancer when the agency signs off.",
    forRoles: ["freelancer", "realtor", "admin", "staff"] as const,
  },
  "assignment.cancelled": {
    label: "When an assignment I'm on is cancelled",
    description: "Sent to the freelancer (if assigned) and the creator.",
    forRoles: ["freelancer", "realtor", "admin", "staff"] as const,
  },
  "assignment.files_uploaded": {
    label: "When files are uploaded to an assignment I'm on",
    description: "Sent to the realtor / creator when the freelancer uploads deliverables, and to the freelancer when the realtor uploads supporting docs.",
    forRoles: ["freelancer", "realtor", "admin", "staff"] as const,
  },
  "assignment.comment_posted": {
    label: "When someone comments on an assignment I'm on",
    description: "Sent to other participants on the thread — commenter is excluded.",
    forRoles: ["freelancer", "realtor", "admin", "staff"] as const,
  },
} as const;

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
