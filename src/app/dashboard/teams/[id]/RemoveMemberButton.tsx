"use client";

import { ConfirmActionButton } from "@/components/ui/ConfirmActionButton";
import { removeTeamMember } from "@/app/actions/teams";

export function RemoveMemberButton({
  teamId,
  userId,
  memberName,
  teamName,
}: {
  teamId: string;
  userId: string;
  memberName: string;
  teamName: string;
}) {
  return (
    <ConfirmActionButton
      action={() => removeTeamMember(teamId, userId)}
      title={`Remove ${memberName} from ${teamName}?`}
      description="They lose access to this team's assignments immediately. Their account and any assignments they personally created stay put."
      confirmLabel="Remove member"
      cancelLabel="Keep"
      triggerLabel="Remove"
    />
  );
}
