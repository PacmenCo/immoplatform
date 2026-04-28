"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Two presentation modes:
 *   - default: in-place panel (no current callers — historically used by
 *     page-route modals like /assignments/[id]/complete; that route was
 *     collapsed into an inline dialog).
 *   - `overlay`: floating dialog with backdrop, body-scroll lock, click-out
 *     and Escape-to-close. Used by every active modal (complete, cancel,
 *     reassign, transfer ownership, delete account). Without the lock, on
 *     touch the page behind scrolls under the dialog.
 *
 * Overlay mode is a true ARIA dialog — `role="dialog"`, `aria-modal="true"`,
 * `aria-labelledby` referencing the title. Focus moves into the panel on
 * open and returns to whichever element triggered the dialog on close.
 */
export function Modal({
  title,
  description,
  children,
  footer,
  closeHref,
  onClose,
  className,
  overlay = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeHref?: string;
  onClose?: () => void;
  className?: string;
  overlay?: boolean;
}) {
  const showClose = !!closeHref || !!onClose;
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overlay) return;
    // Remember the trigger so we can return focus when the dialog closes —
    // without this the keyboard user lands on <body> after Escape and loses
    // their place on the page.
    const trigger =
      typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first interactive element inside the panel (or the panel
    // itself if there isn't one). Without this, screen readers won't shift
    // focus into the dialog and Tab starts in <body>, escaping it
    // immediately on first press.
    const id = window.requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (focusable ?? panelRef.current)?.focus();
    });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose) {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      // Return focus to the opener once the dialog is gone.
      trigger?.focus?.();
    };
  }, [overlay, onClose]);

  const closeIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );

  const closeBtnClass =
    "absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-md text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";

  const panel = (
    <div
      className={cn(
        "relative rounded-[var(--radius-lg)] bg-[var(--color-bg-muted)]/60 p-6",
        className,
      )}
    >
      <div
        ref={panelRef}
        role={overlay ? "dialog" : undefined}
        aria-modal={overlay ? true : undefined}
        aria-labelledby={overlay ? titleId : undefined}
        tabIndex={overlay ? -1 : undefined}
        className="relative mx-auto max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)] focus:outline-none"
      >
        {showClose && (
          closeHref ? (
            <Link href={closeHref} aria-label="Close" className={closeBtnClass}>
              {closeIcon}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={closeBtnClass}
            >
              {closeIcon}
            </button>
          )
        )}
        <div className="border-b border-[var(--color-border)] px-6 py-5 pr-14">
          <h2 id={titleId} className="text-base font-semibold text-[var(--color-ink)]">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {description}
            </p>
          )}
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-alt)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (!overlay) return panel;

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(15,23,42,0.5)] p-4 sm:p-8"
    >
      {panel}
    </div>
  );
}
