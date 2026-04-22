import { redirect } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { AnnouncementForm } from "@/components/dashboard/AnnouncementForm";
import { requireSession } from "@/lib/auth";
import { canManageAnnouncements } from "@/lib/permissions";
import { createAnnouncement } from "@/app/actions/announcements";

export default async function NewAnnouncementPage() {
  const session = await requireSession();
  if (!canManageAnnouncements(session)) {
    redirect("/no-access?section=announcements");
  }

  return (
    <>
      <Topbar title="New announcement" subtitle="Create a banner message for users" />
      <AnnouncementForm
        action={createAnnouncement}
        cancelHref="/dashboard/announcements"
      />
    </>
  );
}
