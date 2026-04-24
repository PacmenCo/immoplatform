import "server-only";
import { TeamRole, type Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * Minimum fields `notify()` needs for an assignment recipient. Keeping this
 * shape narrow (no `lastName` separately — wrap with `fullName()` when
 * needed) means every recipient query selects the same five columns.
 *
 * `emailPrefs` is the JSONB column — `Prisma.JsonValue` covers object /
 * string / null shapes. `shouldSendEmail()` normalizes at read time.
 */
export type Recipient = {
  id: string;
  email: string;
  emailPrefs: Prisma.JsonValue | null;
  firstName: string;
  lastName: string;
};

const RECIPIENT_SELECT = {
  id: true,
  email: true,
  emailPrefs: true,
  firstName: true,
  lastName: true,
} as const;

/**
 * Collect the "agency side" humans to notify about an assignment: the
 * creator + all team owners. Deduplicated, filters soft-deleted users,
 * excludes ids in `exclude` (typically the actor so they don't self-email).
 *
 * Safe when `teamId` or `createdById` are null — the OR collapses to match
 * nothing rather than matching everyone (empty-object filter drops them).
 */
export async function collectAgencyRecipients(opts: {
  teamId: string | null;
  createdById: string | null;
  exclude: string[];
}): Promise<Recipient[]> {
  const excludeSet = new Set(opts.exclude);
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        opts.createdById ? { id: opts.createdById } : {},
        opts.teamId
          ? {
              memberships: {
                some: { teamId: opts.teamId, teamRole: TeamRole.owner },
              },
            }
          : {},
      ].filter((c) => Object.keys(c).length > 0),
    },
    select: RECIPIENT_SELECT,
  });
  return users.filter((u) => !excludeSet.has(u.id));
}

export async function loadUser(id: string | null): Promise<Recipient | null> {
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: RECIPIENT_SELECT,
  });
}
