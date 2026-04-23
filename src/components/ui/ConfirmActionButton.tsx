"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorAlert } from "./ErrorAlert";
import type { ActionResult } from "@/app/actions/_types";

type Props = {
  /** Pre-bound action (e.g. `() => deleteTeam(teamId)`). */
  action: () => Promise<ActionResult>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Trigger button content — label, optionally with an icon. */
  triggerLabel: ReactNode;
  triggerVariant?: "ghost" | "danger";
  triggerSize?: "sm" | "md";
  /** Where to go on success. Defaults to `router.refresh()` when omitted. */
  redirectTo?: string;
};

/**
 * Button + ConfirmDialog wrapper for destructive or one-way actions. Handles
 * the pending / error / navigate-on-success boilerplate that was otherwise
 * reimplemented in every delete-confirm button.
 *
 * Single-password confirms (e.g. account deletion) need their own flow because
 * a ConfirmDialog doesn't host form fields — keep those as dedicated components.
 */
export function ConfirmActionButton({
  action,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  triggerLabel,
  triggerVariant = "ghost",
  triggerSize = "sm",
  redirectTo,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setOpen(false);
    setError(null);
    start(async () => {
      const res = await action();
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
      <Button
        variant={triggerVariant}
        size={triggerSize}
        onClick={() => setOpen(true)}
        loading={pending}
      >
        {triggerLabel}
      </Button>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <ConfirmDialog
        open={open}
        tone="danger"
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
