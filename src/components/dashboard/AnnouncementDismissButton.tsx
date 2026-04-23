"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconX } from "@/components/ui/Icons";
import { dismissAnnouncement } from "@/app/actions/announcements";

export function AnnouncementDismissButton({ announcementId }: { announcementId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      aria-label="Dismiss announcement"
      className="shrink-0 rounded-md p-1 text-current/70 transition hover:bg-current/10 disabled:opacity-50"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const res = await dismissAnnouncement(announcementId);
          if (res.ok) router.refresh();
        });
      }}
    >
      <IconX size={14} />
    </button>
  );
}
