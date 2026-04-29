"use client";

import { useTransition, useState } from "react";
import { IconCheck, IconAlert, IconRefresh } from "@/components/ui/Icons";
import { retryAssignmentOdooSync } from "@/app/actions/assignments";

/**
 * Per-row Odoo sync status for the assignments list. Mirrors v1's
 * `assignments-list.blade.php:522-538` four-state cell.
 *
 * Props are typed inline (not imported from @/lib/odoo-sync) so this
 * client component doesn't accidentally drag `server-only` modules into
 * the client bundle.
 *
 * State map (matches v1):
 *   - synced (green)  : odooSyncedAt && !odooSyncError
 *   - warning (amber) : odooSyncedAt && odooSyncError       — read-only
 *   - failed (red)    : !odooSyncedAt && odooSyncError      — click → retry
 *   - pending (gray)  : !odooSyncedAt && !odooSyncError     — click → force run
 */
type Props = {
  assignmentId: string;
  odooSyncedAt: Date | null;
  odooSyncError: string | null;
  odooContactId: number | null;
  odooOrderId: number | null;
};

export function OdooSyncCell({
  assignmentId,
  odooSyncedAt,
  odooSyncError,
  odooContactId,
  odooOrderId,
}: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isSynced = !!odooSyncedAt && !odooSyncError;
  const isWarning = !!odooSyncedAt && !!odooSyncError;
  const isFailed = !odooSyncedAt && !!odooSyncError;
  // remainder ("pending" — not yet attempted): no odooSyncedAt, no error.

  function retry() {
    setError(null);
    start(async () => {
      // The action returns ActionResult — but a network abort or session
      // expiry can still throw. Catch so a thrown promise doesn't get
      // swallowed by useTransition with no user feedback.
      try {
        const res = await retryAssignmentOdooSync(assignmentId);
        if (!res.ok) setError(res.error);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed");
      }
    });
  }

  if (isSynced) {
    const tooltip = `Synced — partner #${odooContactId ?? "?"}, order #${odooOrderId ?? "?"}`;
    return (
      <span title={tooltip} className="inline-flex" aria-label={tooltip}>
        <IconCheck size={18} className="text-emerald-600" />
      </span>
    );
  }

  if (isWarning) {
    return (
      <span
        title={odooSyncError ?? ""}
        className="inline-flex"
        aria-label={odooSyncError ?? "Synced with warnings"}
      >
        <IconAlert size={18} className="text-amber-500" />
      </span>
    );
  }

  // Failed or pending — both render a clickable retry button. Disabled on
  // isPending (not just spinner) so a double-click can't fire two syncs.
  const tooltip = isFailed
    ? (odooSyncError ?? "Sync failed — click to retry")
    : "Pending — click to sync now";
  const colorClass = isFailed
    ? "text-red-500 hover:text-red-700"
    : "text-gray-400 hover:text-gray-600";
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={retry}
        disabled={pending}
        title={tooltip}
        aria-label={tooltip}
        className="inline-flex disabled:opacity-50"
      >
        <IconRefresh
          size={18}
          className={`${colorClass} ${pending ? "animate-spin" : ""}`}
        />
      </button>
      {error && (
        <span
          role="alert"
          className="whitespace-nowrap rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white"
        >
          {error}
        </span>
      )}
    </span>
  );
}
