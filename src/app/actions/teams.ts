"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireSession } from "@/lib/auth";
import { canEditTeam, hasRole } from "@/lib/permissions";
import type { ActionResult } from "./invites";

export async function transferTeamOwnership(
  teamId: string,
  newOwnerUserId: string,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const allowed = hasRole(session, "admin") || (await canEditTeam(session, teamId));
  if (!allowed) {
    return { ok: false, error: "You don't have permission to transfer ownership." };
  }

  // The target must currently be a member of the team, still active, and
  // have a platform role that's eligible to own a team.
  const target = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: newOwnerUserId } },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!target) {
    return {
      ok: false,
      error:
        "That user is no longer a member of this team. Refresh the page and try again.",
    };
  }
  if (target.user.deletedAt) {
    return { ok: false, error: "That account is deactivated." };
  }
  if (!["realtor", "admin"].includes(target.user.role)) {
    return {
      ok: false,
      error:
        "Team ownership can only be transferred to a realtor or admin. Change their platform role first.",
    };
  }
  if (target.teamRole === "owner") {
    return { ok: false, error: "That user is already the team owner." };
  }

  await prisma.$transaction(async (tx) => {
    // Demote all current owners to member (handles multi-owner edge cases safely).
    await tx.teamMember.updateMany({
      where: { teamId, teamRole: "owner" },
      data: { teamRole: "member" },
    });
    // Promote the target to owner.
    await tx.teamMember.update({
      where: { teamId_userId: { teamId, userId: newOwnerUserId } },
      data: { teamRole: "owner" },
    });
  });

  await audit({
    actorId: session.user.id,
    verb: "team.ownership_transferred",
    objectType: "team",
    objectId: teamId,
    metadata: {
      newOwnerUserId,
      newOwnerName: `${target.user.firstName} ${target.user.lastName}`,
    },
  });

  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath("/dashboard/teams");
  return { ok: true };
}
