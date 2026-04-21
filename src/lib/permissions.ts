import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { SessionWithUser } from "./auth";

// ─── Roles ─────────────────────────────────────────────────────────

export type Role = "admin" | "staff" | "realtor" | "freelancer";

export function role(s: SessionWithUser): Role {
  return s.user.role as Role;
}

export function hasRole(s: SessionWithUser, ...rs: Role[]): boolean {
  return rs.includes(role(s));
}

// ─── Membership lookup (memoised per request via React cache()) ───

export const getUserTeamIds = cache(async (userId: string) => {
  const rows = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true, teamRole: true },
  });
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
 */
export async function canUpdateAssignmentFields(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  if (hasRole(s, "freelancer")) return false;
  return canEditAssignment(s, a);
}

/**
 * Mark a delivered assignment as completed. Freelancers never complete — they
 * delivered their own work; the agency signs off. Owner-level only on the
 * realtor side (matches canEditAssignment) — a team member who can't edit
 * the assignment pre-completion shouldn't be able to close it either.
 */
export async function canCompleteAssignment(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  if (hasRole(s, "admin", "staff")) return true;
  if (hasRole(s, "freelancer")) return false;
  if (!hasRole(s, "realtor")) return false;
  const { owned } = await getUserTeamIds(s.user.id);
  return a.createdById === s.user.id || (!!a.teamId && owned.includes(a.teamId));
}

/**
 * Cancel policy matches edit — if you can edit it, you can cancel it.
 * Freelancers can cancel their own assigned jobs (they drop out).
 */
export async function canCancelAssignment(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  return canEditAssignment(s, a);
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
