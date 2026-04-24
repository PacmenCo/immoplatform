import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { SessionWithUser } from "./auth";
import type { Role } from "./permissions.types";
import { parseRole } from "./enum-validation";

// ─── Roles ─────────────────────────────────────────────────────────

// Re-export the client-safe Role union so callers that already
// `import { Role } from "@/lib/permissions"` keep working.
export type { Role };

// Run every session-derived role through parseRole so a drifted
// `users.role` value falls back to "freelancer" (least-privileged) and
// emits a warning, instead of silently typing through as an unexpected
// Role literal.
export function role(s: SessionWithUser): Role {
  return parseRole(s.user.role, "session.user.role");
}

export function hasRole(s: SessionWithUser, ...rs: Role[]): boolean {
  return rs.includes(role(s));
}

// ─── Membership lookup (memoised per request via React cache()) ───

// Canonical per-request membership query — returns rows with team branding
// (used by the Topbar switcher) and role (used by scope helpers). All
// other membership accessors derive from this so the layout + scope helpers
// + Topbar share one round-trip.
export const getUserTeamsForSwitcher = cache(async (userId: string) => {
  return prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: { select: { id: true, name: true, logo: true, logoColor: true, city: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
});

export const getUserTeamIds = cache(async (userId: string) => {
  const rows = await getUserTeamsForSwitcher(userId);
  return {
    all: rows.map((r) => r.teamId),
    owned: rows.filter((r) => r.teamRole === "owner").map((r) => r.teamId),
  };
});

// ─── Compose helper ────────────────────────────────────────────────

/**
 * AND-compose multiple optional Prisma where clauses. Filters out
 * undefined / null. Use this instead of spread-merging — prevents
 * silent key collisions and correctly preserves nested OR / NOT.
 *
 *   where: composeWhere({ status: "delivered" }, await assignmentScope(s))
 *
 * Constrained to shapes that expose an `AND` field — every Prisma-generated
 * WhereInput satisfies this, so the cast is honest within its intended use.
 */
type WhereLike = { AND?: unknown };

export function composeWhere<T extends WhereLike>(
  ...clauses: Array<T | undefined | null>
): T {
  const present = clauses.filter((c): c is T => !!c);
  if (present.length === 0) return {} as T;
  if (present.length === 1) return present[0]!;
  return { AND: present } as T;
}

// ─── Query scopes (undefined = no filter) ──────────────────────────

export async function assignmentScope(
  s: SessionWithUser,
): Promise<Prisma.AssignmentWhereInput | undefined> {
  if (hasRole(s, "admin", "staff")) return undefined;
  const { all } = await getUserTeamIds(s.user.id);
  if (hasRole(s, "realtor")) {
    // createdById branch keeps the list in sync with canViewAssignment — a realtor
    // who created a row still sees it after leaving the team.
    return {
      OR: [{ createdById: s.user.id }, { teamId: { in: all } }],
    };
  }
  // freelancer — union: assigned-to-me OR member-of-its-team
  return {
    OR: [{ freelancerId: s.user.id }, { teamId: { in: all } }],
  };
}

export async function teamScope(
  s: SessionWithUser,
): Promise<Prisma.TeamWhereInput | undefined> {
  if (hasRole(s, "admin", "staff")) return undefined;
  const { all } = await getUserTeamIds(s.user.id);
  return { id: { in: all } };
}

export async function userScope(
  s: SessionWithUser,
): Promise<Prisma.UserWhereInput | undefined> {
  if (hasRole(s, "admin", "staff")) return undefined;
  const { all } = await getUserTeamIds(s.user.id);
  return { memberships: { some: { teamId: { in: all } } } };
}

// ─── Policies ──────────────────────────────────────────────────────

/**
 * Minimum assignment shape every policy function needs. Exported so
 * server actions can type their local assignment projections without
 * re-declaring the shape (prevents silent drift if we add a 4th field).
 */
export type AssignmentPolicyInput = {
  teamId: string | null;
  freelancerId: string | null;
  createdById: string | null;
};

export async function canViewAssignment(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  if (hasRole(s, "admin", "staff")) return true;
  const { all } = await getUserTeamIds(s.user.id);
  if (hasRole(s, "realtor")) {
    return (
      a.createdById === s.user.id ||
      (!!a.teamId && all.includes(a.teamId))
    );
  }
  // freelancer
  return (
    a.freelancerId === s.user.id ||
    (!!a.teamId && all.includes(a.teamId))
  );
}

/**
 * Wide edit — status transitions (start, deliver, mark) AND field edits.
 * Freelancers get this on their own rows so they can mark delivered; use
 * `canUpdateAssignmentFields` for the narrower "rewrite address/contacts"
 * case where freelancers must be excluded.
 */
export async function canEditAssignment(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  if (hasRole(s, "admin", "staff")) return true;
  if (hasRole(s, "freelancer")) return a.freelancerId === s.user.id;
  if (!hasRole(s, "realtor")) return false;
  const { owned } = await getUserTeamIds(s.user.id);
  return a.createdById === s.user.id || (!!a.teamId && owned.includes(a.teamId));
}

/**
 * Narrow edit — rewrites to property address, contacts, services, scheduling.
 * Freelancers cannot modify these fields on their own assigned rows; they
 * only transition state. Prevents a freelancer from tampering with the
 * property record or contact data.
 *
 * The UPDATE action gate for freelancers is intentionally wider than this:
 * a freelancer may hit the update endpoint to change appointment date,
 * status, and append a comment. The `FREELANCER_UPDATE_FIELDS` allowlist
 * below declares exactly which fields survive the filter on that path;
 * everything else in the submitted FormData is silently dropped.
 */
export async function canUpdateAssignmentFields(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  if (hasRole(s, "freelancer")) return false;
  return canEditAssignment(s, a);
}

/**
 * Platform parity (AssignmentController::update @ app/Http/Controllers/
 * AssignmentController.php:406-425): when a freelancer posts to the update
 * endpoint, only these fields are validated and written — everything else
 * on the form is ignored. Declared as data (array), not an if-ladder, so
 * the policy is auditable in one place.
 *
 * Platform → Immo field mapping:
 *   actual_date   → preferredDate   (the scheduled appointment date)
 *   status_id     → status          (constrained by ROLE_ALLOWED_STATUSES)
 *   new_comment   → newComment      (a comment to append, not a field edit)
 *
 * The form names here mirror the FormData keys `updateAssignment` reads —
 * change both together.
 */
export const FREELANCER_UPDATE_FIELDS = [
  "preferred-date", // appointment date
  "status",         // status flip (further gated by ROLE_ALLOWED_STATUSES)
  "new-comment",    // appended to the thread; not a row field
] as const;
export type FreelancerUpdateField = (typeof FREELANCER_UPDATE_FIELDS)[number];

/**
 * Keep only the freelancer-safe keys on an incoming FormData. Returns a
 * fresh FormData so the caller can thread it through the rest of the
 * action unchanged; everything not on the allowlist is dropped silently,
 * matching Platform (which validates on a 3-field schema and ignores the
 * rest of the request payload).
 */
export function filterUpdateForFreelancer(raw: FormData): FormData {
  const out = new FormData();
  for (const key of FREELANCER_UPDATE_FIELDS) {
    const values = raw.getAll(key);
    for (const v of values) out.append(key, v);
  }
  return out;
}

/**
 * Mark a delivered assignment as completed. Owner-level realtors + assigned
 * freelancers + admin/staff. Platform parity — AssignmentController.php:1066
 * (markFinished) allows the freelancer to self-complete; we align by allowing
 * the assigned freelancer through the gate. Team members who aren't owner and
 * aren't the freelancer still can't complete.
 */
export async function canCompleteAssignment(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  if (hasRole(s, "admin", "staff")) return true;
  if (hasRole(s, "freelancer")) return a.freelancerId === s.user.id;
  if (!hasRole(s, "realtor")) return false;
  const { owned } = await getUserTeamIds(s.user.id);
  return a.createdById === s.user.id || (!!a.teamId && owned.includes(a.teamId));
}

/**
 * Delete an assignment. Platform parity (AssignmentPolicy::delete):
 *   - admin: any assignment
 *   - medewerker/staff: never (explicit exclusion in Platform)
 *   - freelancer: never
 *   - makelaar/realtor: only their own (owner or team-owner), and only if the
 *     status is "deletable" — completed + delivered are kept for the invoice +
 *     commission audit trail; cancelled and earlier states are fair game.
 */
const DELETABLE_STATUSES = ["draft", "scheduled", "in_progress", "cancelled"] as const;

export async function canDeleteAssignment(
  s: SessionWithUser,
  a: AssignmentPolicyInput & { status: string },
): Promise<boolean> {
  if (hasRole(s, "admin")) return true;
  if (hasRole(s, "staff")) return false;
  if (hasRole(s, "freelancer")) return false;
  if (!hasRole(s, "realtor")) return false;
  if (!DELETABLE_STATUSES.includes(a.status as typeof DELETABLE_STATUSES[number])) {
    return false;
  }
  const { owned } = await getUserTeamIds(s.user.id);
  return a.createdById === s.user.id || (!!a.teamId && owned.includes(a.teamId));
}

/**
 * Cancel policy — admin/staff + the owning realtor (creator or team owner).
 * Freelancers cannot cancel: Platform parity (StatusSeeder's role_status pivot
 * grants freelancers only `In afwachting`, `In verwerking`, `Ingepland` — they
 * can't pick `Geannuleerd` in the Platform UI). A freelancer who no longer
 * wants a job asks admin/staff to reassign (`canReassignFreelancer`) instead
 * of terminating the whole assignment. This keeps the realtor from having to
 * re-create the row every time an inspector walks away.
 */
export async function canCancelAssignment(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  if (hasRole(s, "admin", "staff")) return true;
  if (!hasRole(s, "realtor")) return false;
  const { owned } = await getUserTeamIds(s.user.id);
  return a.createdById === s.user.id || (!!a.teamId && owned.includes(a.teamId));
}

/**
 * Assigning or reassigning the freelancer is an agency-side operation —
 * admin/staff only, matching Platform. Realtors see the assigned inspector
 * read-only; freelancers can never reassign (that's a cancel, handled
 * elsewhere).
 */
export function canReassignFreelancer(s: SessionWithUser): boolean {
  return hasRole(s, "admin", "staff");
}

export async function canEditTeam(
  s: SessionWithUser,
  teamId: string,
): Promise<boolean> {
  if (hasRole(s, "admin")) return true;
  if (!hasRole(s, "realtor")) return false;
  const { owned } = await getUserTeamIds(s.user.id);
  return owned.includes(teamId);
}

/**
 * Create a new team. Admin/staff + realtors can — they become the initial
 * owner. Freelancers cannot — they join existing agencies via invite.
 */
export function canCreateTeam(s: SessionWithUser): boolean {
  return hasRole(s, "admin", "staff", "realtor");
}

/**
 * Create an assignment. Admin/staff + realtors. Freelancers never —
 * Platform's @can('create', Assignment) gate + createAssignmentInner's
 * explicit freelancer rejection. Used to hide CTAs and gate the new-
 * assignment page, not just the action.
 */
export function canCreateAssignment(s: SessionWithUser): boolean {
  return hasRole(s, "admin", "staff", "realtor");
}

/**
 * Set or clear the discount on an assignment. Admin/staff only — matches
 * Platform, where discounts are administratively applied and not a realtor
 * self-serve feature.
 */
export function canSetDiscount(s: SessionWithUser): boolean {
  return hasRole(s, "admin", "staff");
}

/**
 * See the pricing breakdown on an assignment (amounts, discount, surcharge).
 * Agency side only — freelancers never see prices since they're compensated
 * via commission / payout, not the invoice amount.
 */
export async function canViewAssignmentPricing(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  if (hasRole(s, "admin", "staff")) return true;
  if (!hasRole(s, "realtor")) return false;
  const { all } = await getUserTeamIds(s.user.id);
  return a.createdById === s.user.id || (!!a.teamId && all.includes(a.teamId));
}

/**
 * View the team's commission lines + quarterly totals. Owners see their own
 * team; admins/staff see everyone's. Freelancers never — they're paid via
 * the platform operator, not a share of the invoice.
 */
export async function canViewCommission(
  s: SessionWithUser,
  teamId: string,
): Promise<boolean> {
  if (hasRole(s, "admin", "staff")) return true;
  if (!hasRole(s, "realtor")) return false;
  const { owned } = await getUserTeamIds(s.user.id);
  return owned.includes(teamId);
}

/** Mark a team's quarterly commission as paid. Admin/staff only. */
export function canMarkCommissionPaid(s: SessionWithUser): boolean {
  return hasRole(s, "admin", "staff");
}

/**
 * Create / delete manual revenue adjustments on the overview dashboard.
 * Admin/staff only — these rewrite the booked-revenue number, so team
 * owners don't get to edit them.
 */
export function canManageRevenueAdjustments(s: SessionWithUser): boolean {
  return hasRole(s, "admin", "staff");
}

/**
 * Publish / edit / delete platform-wide announcements. Admin + staff only —
 * these banners reach every logged-in user. Matches the sidebar's
 * visibleFor gate on /dashboard/announcements.
 *
 * Deliberate deviation from Platform: Platform's routes gate announcements
 * to admin only (role:admin on the announcement routes). We include staff
 * because immo's sidebar lists the page for ["admin","staff"] and staff
 * routinely manage banner copy operationally. Tighten to admin-only here
 * AND in components/dashboard/Sidebar.tsx:60 if you want strict parity.
 */
export function canManageAnnouncements(s: SessionWithUser): boolean {
  return hasRole(s, "admin", "staff");
}

/**
 * Can the viewer open a user record? Staff are blocked from seeing admins
 * or other staff — only admins see the full user set. Users may always
 * view themselves.
 */
export function canViewUser(
  s: SessionWithUser,
  target: { id: string; role: string },
): boolean {
  if (s.user.id === target.id) return true;
  if (hasRole(s, "admin")) return true;
  if (hasRole(s, "staff")) {
    return !["admin", "staff"].includes(target.role);
  }
  return false;
}

/**
 * Edit, reset password, or delete another user account. Platform parity
 * (UserPolicy::update) — admin-only. No self-edit via this gate; the
 * settings page covers self-profile.
 */
export function canAdminUsers(s: SessionWithUser): boolean {
  return hasRole(s, "admin");
}

/**
 * Role where-clause filter for the user list, matching canViewUser. Admin sees
 * all; staff sees realtors + freelancers. Pair with a separate "always me"
 * branch when you want the viewer's own row visible regardless of filter.
 */
export function userListRoleFilter(
  s: SessionWithUser,
): { role: { notIn: Role[] } } | undefined {
  if (hasRole(s, "admin")) return undefined;
  if (hasRole(s, "staff")) return { role: { notIn: ["admin", "staff"] } };
  return { role: { notIn: ["admin", "staff", "realtor", "freelancer"] } }; // nobody
}

// ─── File policies ─────────────────────────────────────────────────

/**
 * Upload the final deliverable (certificate PDFs) to the freelancer lane.
 * Only the assigned freelancer, plus admin/staff overrides.
 */
export async function canUploadToFreelancerLane(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  if (hasRole(s, "admin", "staff")) return true;
  if (!hasRole(s, "freelancer")) return false;
  return a.freelancerId === s.user.id;
}

/**
 * Upload supporting docs to the realtor lane. Realtor team members of the
 * assignment's team (or creator), plus admin/staff. Freelancers never.
 */
export async function canUploadToRealtorLane(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  if (hasRole(s, "admin", "staff")) return true;
  if (hasRole(s, "freelancer")) return false;
  if (!hasRole(s, "realtor")) return false;
  const { all } = await getUserTeamIds(s.user.id);
  return a.createdById === s.user.id || (!!a.teamId && all.includes(a.teamId));
}

/**
 * View the file list + download any file on an assignment. Same gate as
 * viewing the assignment itself — both lanes visible to everyone who can
 * see the assignment (freelancers included).
 */
export async function canViewAssignmentFiles(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  return canViewAssignment(s, a);
}

/**
 * Delete (soft-delete) a single file. The uploader can always delete their
 * own upload. Admin/staff can delete any. Peers and other tenants cannot.
 */
export async function canDeleteAssignmentFile(
  s: SessionWithUser,
  file: { uploaderId: string | null },
): Promise<boolean> {
  if (hasRole(s, "admin", "staff")) return true;
  return file.uploaderId === s.user.id;
}

/**
 * Can `session` act on `invite` (resend or revoke)?
 * - admin / staff: any invite
 * - realtor: only invites they sent, for a team they still own
 * - freelancer: never
 */
export async function canActOnInvite(
  s: SessionWithUser,
  invite: { invitedById: string; teamId: string | null },
): Promise<boolean> {
  if (hasRole(s, "admin", "staff")) return true;
  if (!hasRole(s, "realtor")) return false;
  if (invite.invitedById !== s.user.id) return false;
  if (!invite.teamId) return false;
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: invite.teamId, userId: s.user.id } },
  });
  return membership?.teamRole === "owner";
}

/**
 * The pool of freelancers the caller may assign. Matches Platform: any
 * active freelancer user is in scope (admin/staff are the only callers —
 * the UI-level `canReassignFreelancer` gate keeps realtors out entirely).
 */
export function eligibleFreelancerWhere(): Prisma.UserWhereInput {
  return { role: "freelancer", deletedAt: null };
}
