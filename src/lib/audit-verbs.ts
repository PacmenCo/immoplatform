/**
 * Maps the canonical audit-verb identifier (`assignment.created`,
 * `user.signed_in`, ...) to the camelCase key under
 * `dashboard.users.detail.verbs.*` in the message catalog.
 *
 * Keep this list in sync with `src/lib/auth.ts` (the `AuditVerb` union)
 * and the catalog. Adding a new verb is a 3-step change:
 *   1. Extend `AuditVerb` in `src/lib/auth.ts`
 *   2. Add the key here
 *   3. Add the EN + nl-BE translations under the verbs namespace
 */
export const VERB_KEYS: Record<string, string> = {
  "assignment.created": "assignmentCreated",
  "assignment.updated": "assignmentUpdated",
  "assignment.started": "assignmentStarted",
  "assignment.completed": "assignmentCompleted",
  "assignment.cancelled": "assignmentCancelled",
  "assignment.deleted": "assignmentDeleted",
  "assignment.reassigned": "assignmentReassigned",
  "assignment.file_uploaded": "assignmentFileUploaded",
  "assignment.file_deleted": "assignmentFileDeleted",
  "assignment.commission_applied": "assignmentCommissionApplied",
  "commission.quarter_paid": "commissionQuarterPaid",
  "commission.quarter_unpaid": "commissionQuarterUnpaid",
  "team.created": "teamCreated",
  "team.updated": "teamUpdated",
  "team.deleted": "teamDeleted",
  "team.member_added": "teamMemberAdded",
  "team.member_removed": "teamMemberRemoved",
  "team.ownership_transferred": "teamOwnershipTransferred",
  "user.created": "userCreated",
  "user.deleted": "userDeleted",
  "user.profile_updated": "userProfileUpdated",
  "user.password_changed": "userPasswordChanged",
  "user.email_changed": "userEmailChanged",
  "user.role_changed": "userRoleChanged",
  "user.signed_in": "userSignedIn",
  "user.signed_out": "userSignedOut",
  "invite.sent": "inviteSent",
  "invite.accepted": "inviteAccepted",
  "announcement.created": "announcementCreated",
  "announcement.updated": "announcementUpdated",
  "announcement.deleted": "announcementDeleted",
  "announcement.dismissed": "announcementDismissed",
  "contact_message.handled": "contactMessageHandled",
  "contact_message.reopened": "contactMessageReopened",
  "revenue_adjustment.created": "revenueAdjustmentCreated",
  "calendar.connected": "calendarConnected",
  "calendar.disconnected": "calendarDisconnected",
};

/**
 * Friendly label for an audit verb. Falls back to a de-dotted human
 * rendering when the verb isn't mapped or the catalog lookup throws —
 * so unmapped verbs stay readable rather than crashing.
 */
export function verbLabel(
  verb: string,
  tVerbs: (key: string) => string,
): string {
  const key = VERB_KEYS[verb];
  if (!key) return verb.replace(/\./g, " ").replace(/_/g, " ");
  try {
    return tVerbs(key);
  } catch {
    return verb.replace(/\./g, " ").replace(/_/g, " ");
  }
}
