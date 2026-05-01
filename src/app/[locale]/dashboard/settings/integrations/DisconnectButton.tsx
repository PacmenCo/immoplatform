"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { disconnectCalendarAccount } from "@/app/actions/calendar";
import { useTranslateError } from "@/i18n/error";
import type { CalendarProvider } from "@/lib/calendar/types";

export function DisconnectButton({ provider }: { provider: CalendarProvider }) {
  const t = useTranslations(
    provider === "google"
      ? "dashboard.settings.integrations.google.disconnect"
      : "dashboard.settings.integrations.outlook.disconnect",
  );
  const tErr = useTranslateError();
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

  return (
    <div className="space-y-2">
      <Button variant="danger" size="sm" onClick={() => setOpen(true)} loading={pending}>
        {t("button")}
      </Button>
      {error && <ErrorAlert>{tErr(error)}</ErrorAlert>}
      <ConfirmDialog
        open={open}
        tone="danger"
        title={t("title")}
        description={t("description")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
