"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { revokeSession, signOutEverywhere } from "@/app/actions/security";

export function RevokeSessionButton({ sessionId, device }: { sessionId: string; device: string }) {
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
        Revoke
      </Button>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <ConfirmDialog
        open={open}
        tone="danger"
        title={`Sign out ${device}?`}
        description="That device will need to sign in again next time it's used. Your current session stays signed in."
        confirmLabel="Revoke session"
        cancelLabel="Cancel"
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export function SignOutAllButton({ hasOthers }: { hasOthers: boolean }) {
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
      setResult(n === 0 ? "No other sessions were active." : `Signed out ${n} other session${n === 1 ? "" : "s"}.`);
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
        Sign out all
      </Button>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      {result && (
        <p className="text-xs text-[var(--color-ink-muted)]" role="status">
          {result}
        </p>
      )}
      <ConfirmDialog
        open={open}
        tone="danger"
        title="Sign out all other sessions?"
        description="Every device except this one will need to sign in again. Use this if you suspect your account is accessed somewhere you don't recognise."
        confirmLabel="Sign out everywhere"
        cancelLabel="Cancel"
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
