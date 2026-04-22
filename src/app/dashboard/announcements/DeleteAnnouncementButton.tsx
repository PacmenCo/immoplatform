"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { deleteAnnouncement } from "@/app/actions/announcements";

type Props = {
  id: string;
  title: string;
  size?: "sm" | "md";
  redirectTo?: string;
};

export function DeleteAnnouncementButton({ id, title, size = "sm", redirectTo }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setOpen(false);
    setError(null);
    start(async () => {
      const res = await deleteAnnouncement(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size={size} onClick={() => setOpen(true)} loading={pending}>
        Delete
      </Button>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <ConfirmDialog
        open={open}
        tone="danger"
        title={`Delete "${title}"?`}
        description="The announcement disappears for everyone. Per-user dismissals are cleared too. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
