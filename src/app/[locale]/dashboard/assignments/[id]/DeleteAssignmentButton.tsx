"use client";

import { useTranslations } from "next-intl";
import { ConfirmActionButton } from "@/components/ui/ConfirmActionButton";
import { IconTrash } from "@/components/ui/Icons";
import { deleteAssignment } from "@/app/actions/assignments";

export function DeleteAssignmentButton({
  assignmentId,
  reference,
}: {
  assignmentId: string;
  reference: string;
}) {
  const t = useTranslations("dashboard.assignments.delete");
  return (
    <ConfirmActionButton
      action={() => deleteAssignment(assignmentId)}
      title={t("title", { reference })}
      description={t("description")}
      confirmLabel={t("confirmLabel")}
      cancelLabel={t("cancelLabel")}
      triggerLabel={
        <>
          <IconTrash size={12} />
          {t("triggerLabel")}
        </>
      }
      redirectTo="/dashboard/assignments"
    />
  );
}
