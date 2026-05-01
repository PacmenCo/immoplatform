"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "./Button";

type Tone = "neutral" | "danger";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Floating confirm dialog — replaces `window.confirm`. Portals to body so
 * parent overflow/z-index can't clip it. Clicking the backdrop, pressing
 * Escape, or clicking Cancel all invoke `onCancel`. `onConfirm` fires on
 * the primary button or Enter.
 *
 * Not a full focus trap (yet) — focuses the primary button on open which
 * covers the common case. Tabbing leaves the dialog; fine for a 2-button
 * modal.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "neutral",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("dashboard.shared.confirmDialog");
  const effectiveConfirm = confirmLabel ?? t("confirm");
  const effectiveCancel = cancelLabel ?? t("cancel");

  useEffect(() => {
    if (!open) return;
    // Focus the primary button once painted — makes Enter-to-confirm and
    // Tab navigation predictable. The confirm button is the last button
    // inside the dialog's footer (primary action always trails cancel).
    const id = window.requestAnimationFrame(() => {
      const buttons = dialogRef.current?.querySelectorAll("button");
      if (buttons && buttons.length > 0) {
        buttons[buttons.length - 1].focus();
      }
    });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter" && dialogRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        onConfirm();
      }
    }
    document.addEventListener("keydown", onKey);
    // Lock body scroll while the dialog is up — otherwise the backdrop
    // scrolls with a click-and-drag on touchpads.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel, onConfirm]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--color-ink)]/40 p-4 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? "confirm-desc" : undefined}
        className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-start gap-3 px-6 pt-6 pb-2">
          <span
            aria-hidden
            className={
              "grid h-10 w-10 shrink-0 place-items-center rounded-full " +
              (tone === "danger"
                ? "bg-[color-mix(in_srgb,var(--color-asbestos)_12%,var(--color-bg))] text-[var(--color-asbestos)]"
                : "bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]")
            }
          >
            <WarnIcon />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-title"
              className="text-base font-semibold text-[var(--color-ink)]"
            >
              {title}
            </h2>
            {description && (
              <p
                id="confirm-desc"
                className="mt-1 text-sm text-[var(--color-ink-soft)]"
              >
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-alt)] px-6 py-4 mt-4">
          <Button variant="ghost" size="md" onClick={onCancel}>
            {effectiveCancel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            size="md"
            onClick={onConfirm}
          >
            {effectiveConfirm}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function WarnIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
