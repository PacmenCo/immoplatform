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
 */
export function composeWhere<T extends object>(
  ...clauses: Array<T | undefined | null>
): T {
  const present = clauses.filter((c): c is T => !!c);
  if (present.length <= 1) return (present[0] ?? ({} as T));
  return ({ AND: present } as unknown) as T;
}

// ─── Query scopes (undefined = no filter) ──────────────────────────

export async function assignmentScope(
  s: SessionWithUser,
): Promise<Prisma.AssignmentWhereInput | undefined> {
  if (hasRole(s, "admin", "staff")) return undefined;
  const { all } = await getUserTeamIds(s.user.id);
  if (hasRole(s, "realtor")) {
    return { teamId: { in: all } };
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

type AssignmentPolicyInput = {
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

export async function canEditAssignment(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  if (hasRole(s, "admin", "staff")) return true;
  // Freelancers can edit their own assigned rows (limited fields controlled
  // at the field level — e.g. they can mark delivered).
  if (hasRole(s, "freelancer")) return a.freelancerId === s.user.id;
  if (!hasRole(s, "realtor")) return false;
  const { owned } = await getUserTeamIds(s.user.id);
  return a.createdById === s.user.id || (!!a.teamId && owned.includes(a.teamId));
}

export async function canDeleteAssignment(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
  statusIsDeletable: boolean,
): Promise<boolean> {
  if (hasRole(s, "admin")) return true;
  if (!statusIsDeletable) return false;
  return canEditAssignment(s, a);
}

/**
 * Pricing visibility — protects agency markup from freelancers, not
 * from co-workers. Any member of the team (owner OR member) can see.
 * Admins/staff always; freelancers never.
 */
export async function canViewAssignmentPricing(
  s: SessionWithUser,
  a: AssignmentPolicyInput,
): Promise<boolean> {
  if (hasRole(s, "admin", "staff")) return true;
  if (hasRole(s, "freelancer")) return false;
  if (!a.teamId) return false;
  const { all } = await getUserTeamIds(s.user.id);
  return all.includes(a.teamId);
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

export function canSetDiscount(s: SessionWithUser): boolean {
  return hasRole(s, "admin", "staff");
}
