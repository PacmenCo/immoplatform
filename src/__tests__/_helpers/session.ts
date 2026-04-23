import type { Role } from "@/lib/permissions.types";
import type { SessionWithUser } from "@/lib/auth";
import { prisma } from "./db";

/**
 * Build a `SessionWithUser` for a test case.
 *
 * Most policy helpers (`canEditAssignment`, `getUserTeamIds`, etc.) accept
 * a `SessionWithUser` and issue their own DB queries based on `user.id`.
 * So the factory does two things:
 *   1) Inserts a User row + Session row into the test DB so lookups find them.
 *   2) Returns a SessionWithUser object shaped exactly like getSession().
 *
 * Pass a `teamId` to set `activeTeamId` on the session (simulates the
 * "currently active team" picker). Pass `membershipTeams` to also insert
 * TeamMember rows so permission helpers that walk memberships see them.
 *
 * The returned object has ALL User fields (minus passwordHash), matching
 * the `SessionUser = Omit<User, "passwordHash">` alias in src/lib/auth.ts.
 */

type MembershipSpec = { teamId: string; teamRole?: "owner" | "member" };

export type MakeSessionOpts = {
  role: Role;
  /** Override the generated user id for tests that need a deterministic id. */
  userId?: string;
  /** Override the first name. Defaults to "Test". */
  firstName?: string;
  /** Override the last name. Defaults to capitalised role, e.g. "Admin". */
  lastName?: string;
  /** Pre-set `session.activeTeamId`. Does NOT create the team — pass a real id. */
  activeTeamId?: string | null;
  /** Insert TeamMember rows for these teams. */
  membershipTeams?: MembershipSpec[];
};

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function makeSession(
  opts: MakeSessionOpts,
): Promise<SessionWithUser> {
  const userId = opts.userId ?? randomId("u");
  const sessionId = randomId("s");

  const user = await prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@test.local`,
      role: opts.role,
      firstName: opts.firstName ?? "Test",
      lastName: opts.lastName ?? opts.role[0].toUpperCase() + opts.role.slice(1),
      passwordHash: null,
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  for (const m of opts.membershipTeams ?? []) {
    await prisma.teamMember.create({
      data: {
        teamId: m.teamId,
        userId,
        teamRole: m.teamRole ?? "member",
      },
    });
  }

  const session = await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      activeTeamId: opts.activeTeamId ?? null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      lastSeenAt: new Date(),
    },
  });

  // Shape the response to match getSession() in src/lib/auth.ts: strip the
  // passwordHash from the user object.
  const { passwordHash: _ph, ...userWithoutHash } = user;
  void _ph;

  return {
    ...session,
    user: userWithoutHash,
  };
}
