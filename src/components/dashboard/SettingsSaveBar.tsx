"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { useFormDirty } from "@/lib/useFormDirty";
import { useUnsavedChanges } from "./UnsavedChangesProvider";

/**
 * Sticky bottom save bar shared across settings subpages.
 *
 * Design:
 * - Sits inside a `<form>` as its terminal element, so the inner submit
 *   button triggers the form's action (keeps React 19 form-action semantics).
 * - Only appears once the form is dirty — quieter UI, and avoids showing a
 *   save prompt on read-only visits.
 * - Registers with `UnsavedChangesProvider` so in-app nav and tab-close both
 *   prompt before discarding edits.
 *
 * Usage:
 *   const ref = useRef<HTMLFormElement>(null);
 *   <form ref={ref} action={formAction}>
 *     …fields…
 *     <SettingsSaveBar
 *       formRef={ref}
 *       pending={pending}
 *       label="Save profile"
 *     />
 *   </form>
 */

type Props = {
  formRef: RefObject<HTMLFormElement | null>;
  pending: boolean;
  /** Submit button label. Defaults to "Save changes". */
  label?: string;
  /** Heading text shown on the left. Defaults to "Unsaved changes". */
  title?: string;
  /** Override when to show the bar (bypass the dirty check). */
  forceVisible?: boolean;
};

export function SettingsSaveBar({
  formRef,
  pending,
  label = "Save changes",
  title = "Unsaved changes",
  forceVisible,
}: Props) {
  const dirty = useFormDirty(formRef);
  useUnsavedChanges(dirty);

  // Reset signal — keep the bar hidden briefly after the form submits so the
  // "saved" state feels calm, even though the server re-renders the page.
  const [justReset, setJustReset] = useState(false);
  const lastPending = useRef(pending);
  useEffect(() => {
    if (lastPending.current && !pending) {
      // Pending just transitioned true → false.
      setJustReset(true);
      const t = setTimeout(() => setJustReset(false), 800);
      return () => clearTimeout(t);
    }
    lastPending.current = pending;
  }, [pending]);

  const visible = forceVisible || dirty || pending;
  if (!visible && !justReset) return null;

  function reset() {
    formRef.current?.reset();
  }

  return (
    <div
      role="region"
      aria-label="Save changes"
      className="sticky bottom-0 z-20 -mx-6 mt-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg)]/80"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
          <p className="text-xs text-[var(--color-ink-muted)]">
            {pending ? "Saving…" : "Don't forget to save before leaving the page."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reset}
            disabled={pending || !dirty}
          >
            Discard
          </Button>
          <Button type="submit" size="sm" loading={pending}>
            {label}
          </Button>
        </div>
      </div>
    </div>
  );
}
