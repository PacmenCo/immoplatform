"use client";

import { ConfirmActionButton } from "@/components/ui/ConfirmActionButton";
import { IconTrash } from "@/components/ui/Icons";
import { deleteTeam } from "@/app/actions/teams";

export function DeleteTeamButton({ teamId, teamName }: { teamId: string; teamName: string }) {
  return (
    <ConfirmActionButton
      action={() => deleteTeam(teamId)}
      title={`Delete ${teamName}?`}
      description="Members, invites, service-price overrides, commission lines and payout history are all removed. Blocked when assignments still reference this team — delete or reassign those first."
      confirmLabel="Delete team"
      cancelLabel="Keep it"
      triggerLabel={
        <>
          <IconTrash size={14} />
          Delete team
        </>
      }
      triggerVariant="danger"
      redirectTo="/dashboard/teams"
    />
  );
}
