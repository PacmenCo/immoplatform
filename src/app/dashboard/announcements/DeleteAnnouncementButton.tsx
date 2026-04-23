"use client";

import { ConfirmActionButton } from "@/components/ui/ConfirmActionButton";
import { deleteAnnouncement } from "@/app/actions/announcements";

type Props = {
  id: string;
  title: string;
  size?: "sm" | "md";
  redirectTo?: string;
};

export function DeleteAnnouncementButton({ id, title, size = "sm", redirectTo }: Props) {
  return (
    <ConfirmActionButton
      action={() => deleteAnnouncement(id)}
      title={`Delete "${title}"?`}
      description="The announcement disappears for everyone. Per-user dismissals are cleared too. This cannot be undone."
      confirmLabel="Delete"
      cancelLabel="Keep it"
      triggerLabel="Delete"
      triggerSize={size}
      redirectTo={redirectTo}
    />
  );
}
