import { getTranslations } from "next-intl/server";
import { localeRedirect } from "@/i18n/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { AnnouncementForm } from "@/components/dashboard/AnnouncementForm";
import { requireSession } from "@/lib/auth";
import { canManageAnnouncements } from "@/lib/permissions";
import { createAnnouncement } from "@/app/actions/announcements";

export default async function NewAnnouncementPage() {
  const session = await requireSession();
  if (!canManageAnnouncements(session)) {
    await localeRedirect("/no-access?section=announcements");
  }

  const t = await getTranslations("dashboard.announcements");

  return (
    <>
      <Topbar title={t("new.title")} subtitle={t("new.subtitle")} />
      <AnnouncementForm
        action={createAnnouncement}
        cancelHref="/dashboard/announcements"
      />
    </>
  );
}
