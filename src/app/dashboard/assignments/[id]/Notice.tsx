"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * Flash a one-shot notice on the assignment detail page from a query param.
 * Used by `createAssignment` to surface partial-success outcomes (the row
 * was created but the supporting-files upload step failed) — the form's
 * `useActionState` value is wiped by `redirect()`, so we forward the warning
 * through `?notice=...` and translate it to a toast on land. The `useRef`
 * gate prevents the toast from re-firing when React re-renders after the
 * Toast provider mounts.
 */
const MESSAGES: Record<string, { kind: "warning"; message: string }> = {
  files_failed: {
    kind: "warning",
    message:
      "Assignment created. Some files failed to upload — try again from the Files tab.",
  },
};

export function Notice({ notice }: { notice: string | null }) {
  const { toast } = useToast();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !notice) return;
    const m = MESSAGES[notice];
    if (!m) return;
    fired.current = true;
    toast.warning(m.message);
  }, [notice, toast]);
  return null;
}
