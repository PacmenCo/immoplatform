"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useFormDirty } from "@/lib/useFormDirty";
import { useUnsavedChanges } from "./UnsavedChangesProvider";

/**
 * Sticky bottom save bar shared across settings subpages.
 *
 * Design:
 * - Sits inside a `<form>` as its terminal element, so the inner submit
 *   button triggers the form's action (keeps React 19 form-action semantics).
 * - Always mounted so React 19 can resolve the submit button as a stable
 *   form-owned element. Visibility is gated by CSS via `hidden` — earlier
 *   versions returned `null` while clean, which made `new FormData(form, btn)`
 *   throw "The specified element is not owned by this form element" the
 *   first time the user clicked Save (the button had just remounted and
 *   React's submitter resolution couldn't find it).
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
  label,
  title,
  forceVisible,
}: Props) {
  const t = useTranslations("dashboard.shared.settingsSaveBar");
  const effectiveLabel = label ?? t("save");
  const effectiveTitle = title ?? t("title");
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

  const visible = forceVisible || dirty || pending || justReset;

  function reset() {
    formRef.current?.reset();
  }

  return (
    <div
      role="region"
      aria-label={t("ariaLabel")}
      hidden={!visible}
      className="sticky bottom-0 z-20 -mx-6 mt-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg)]/80"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-ink)]">{effectiveTitle}</p>
          <p className="text-xs text-[var(--color-ink-muted)]">
            {pending ? t("saving") : t("hint")}
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
            {t("discard")}
          </Button>
          <Button type="submit" size="sm" loading={pending}>
            {effectiveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
