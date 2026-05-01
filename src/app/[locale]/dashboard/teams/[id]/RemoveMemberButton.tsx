"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("dashboard.teams.detail.removeMember");
  return (
    <ConfirmActionButton
      action={() => removeTeamMember(teamId, userId)}
      title={t("confirmTitle", { member: memberName, team: teamName })}
      description={t("confirmDescription")}
      confirmLabel={t("confirmLabel")}
      cancelLabel={t("cancelLabel")}
      triggerLabel={t("trigger")}
    />
  );
}
