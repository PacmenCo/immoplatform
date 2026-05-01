"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { revokeSession, signOutEverywhere } from "@/app/actions/security";
import { useTranslateError } from "@/i18n/error";

export function RevokeSessionButton({ sessionId, device }: { sessionId: string; device: string }) {
  const t = useTranslations("dashboard.settings.security.sessions");
  const tErr = useTranslateError();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setOpen(false);
    setError(null);
    start(async () => {
      const res = await revokeSession(sessionId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        loading={pending}
      >
        {t("revoke")}
      </Button>
      {error && <ErrorAlert>{tErr(error)}</ErrorAlert>}
      <ConfirmDialog
        open={open}
        tone="danger"
        title={t("revokeTitle", { device })}
        description={t("revokeDescription")}
        confirmLabel={t("revokeConfirm")}
        cancelLabel={t("cancel")}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export function SignOutAllButton({ hasOthers }: { hasOthers: boolean }) {
  const t = useTranslations("dashboard.settings.security.signOutAll");
  const tErr = useTranslateError();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function run() {
    setOpen(false);
    setError(null);
    setResult(null);
    start(async () => {
      const res = await signOutEverywhere();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const n = res.data?.count ?? 0;
      setResult(n === 0 ? t("noOthers") : t("signedOut", { count: n }));
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="danger"
        size="sm"
        onClick={() => setOpen(true)}
        loading={pending}
        disabled={!hasOthers}
      >
        {t("button")}
      </Button>
      {error && <ErrorAlert>{tErr(error)}</ErrorAlert>}
      {result && (
        <p className="text-xs text-[var(--color-ink-muted)]" role="status">
          {result}
        </p>
      )}
      <ConfirmDialog
        open={open}
        tone="danger"
        title={t("confirmTitle")}
        description={t("confirmDescription")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
