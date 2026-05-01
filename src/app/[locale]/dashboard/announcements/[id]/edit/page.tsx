import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { localeRedirect } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManageAnnouncements } from "@/lib/permissions";
import { Topbar } from "@/components/dashboard/Topbar";
import {
  AnnouncementForm,
  type AnnouncementFormInitial,
} from "@/components/dashboard/AnnouncementForm";
import { updateAnnouncement } from "@/app/actions/announcements";

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!canManageAnnouncements(session)) {
    await localeRedirect("/no-access?section=announcements");
  }

  const { id } = await params;
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) notFound();

  const t = await getTranslations("dashboard.announcements");

  const initial: AnnouncementFormInitial = {
    title: a.title,
    body: a.body,
    type: (["info", "success", "warning", "danger"] as const).includes(a.type as never)
      ? (a.type as AnnouncementFormInitial["type"])
      : "info",
    startsAt: toDateInput(a.startsAt),
    endsAt: toDateInput(a.endsAt),
    isActive: a.isActive,
    isDismissible: a.isDismissible,
  };

  const boundUpdate = updateAnnouncement.bind(null, id);

  return (
    <>
      <Topbar title={t("edit.title")} subtitle={a.title} />
      <AnnouncementForm
        action={boundUpdate}
        initial={initial}
        cancelHref={`/dashboard/announcements/${id}`}
      />
    </>
  );
}
