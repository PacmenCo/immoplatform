"use client";

import { useTranslations } from "next-intl";
import { ConfirmActionButton } from "@/components/ui/ConfirmActionButton";
import { IconTrash } from "@/components/ui/Icons";
import { deleteTeam } from "@/app/actions/teams";

export function DeleteTeamButton({ teamId, teamName }: { teamId: string; teamName: string }) {
  const t = useTranslations("dashboard.teams.detail.delete");
  return (
    <ConfirmActionButton
      action={() => deleteTeam(teamId)}
      title={t("confirmTitle", { name: teamName })}
      description={t("confirmDescription")}
      confirmLabel={t("confirmLabel")}
      cancelLabel={t("cancelLabel")}
      triggerLabel={
        <>
          <IconTrash size={14} />
          {t("trigger")}
        </>
      }
      triggerVariant="danger"
      redirectTo="/dashboard/teams"
    />
  );
}
