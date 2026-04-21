"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { disconnectCalendarAccount } from "@/app/actions/calendar";
import type { CalendarProvider } from "@/lib/calendar/types";

export function DisconnectButton({ provider }: { provider: CalendarProvider }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setOpen(false);
    setError(null);
    start(async () => {
      const res = await disconnectCalendarAccount(provider);
      if (!res.ok) setError(res.error);
    });
  }

  const label = provider === "google" ? "Google" : "Outlook";

  return (
    <div className="space-y-2">
      <Button variant="danger" size="sm" onClick={() => setOpen(true)} loading={pending}>
        Disconnect {label}
      </Button>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <ConfirmDialog
        open={open}
        tone="danger"
        title={`Disconnect ${label} calendar?`}
        description={
          provider === "google"
            ? "Future assignment events won't land on your Google calendar until you reconnect. Events you already added stay where they are."
            : "Future assignment events won't sync to Outlook until you reconnect. Events already created stay on your calendar."
        }
        confirmLabel="Disconnect"
        cancelLabel="Keep connected"
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
