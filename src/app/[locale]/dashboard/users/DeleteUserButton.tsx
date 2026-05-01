"use client";

import { useTranslations } from "next-intl";
import { ConfirmActionButton } from "@/components/ui/ConfirmActionButton";
import { deleteUserByAdmin } from "@/app/actions/users";

type Props = {
  userId: string;
  userName: string;
  redirectTo?: string;
  size?: "sm" | "md";
};

export function DeleteUserButton({ userId, userName, redirectTo, size = "sm" }: Props) {
  const t = useTranslations("dashboard.users.edit.delete");
  return (
    <ConfirmActionButton
      action={() => deleteUserByAdmin(userId)}
      title={t("confirmTitle", { name: userName })}
      description={t("confirmDescription")}
      confirmLabel={t("confirmLabel")}
      cancelLabel={t("cancelLabel")}
      triggerLabel={t("trigger")}
      triggerSize={size}
      redirectTo={redirectTo}
    />
  );
}
