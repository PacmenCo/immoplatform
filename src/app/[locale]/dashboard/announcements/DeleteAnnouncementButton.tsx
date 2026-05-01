"use client";

import { useTranslations } from "next-intl";
import { ConfirmActionButton } from "@/components/ui/ConfirmActionButton";
import { deleteAnnouncement } from "@/app/actions/announcements";

type Props = {
  id: string;
  title: string;
  size?: "sm" | "md";
  redirectTo?: string;
};

export function DeleteAnnouncementButton({ id, title, size = "sm", redirectTo }: Props) {
  const t = useTranslations("dashboard.announcements.delete");
  return (
    <ConfirmActionButton
      action={() => deleteAnnouncement(id)}
      title={t("title", { title })}
      description={t("description")}
      confirmLabel={t("confirmLabel")}
      cancelLabel={t("cancelLabel")}
      triggerLabel={t("trigger")}
      triggerSize={size}
      redirectTo={redirectTo}
    />
  );
}
