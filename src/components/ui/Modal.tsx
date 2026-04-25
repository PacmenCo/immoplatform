"use client";

import Link from "next/link";
import { useEffect } from "react";
import { cn } from "@/lib/cn";

/**
 * Two presentation modes:
 *   - default: in-place panel (used by /assignments/[id]/complete which is a
 *     page-route modal — the page IS the dialog).
 *   - `overlay`: floating dialog with backdrop, body-scroll lock, click-out
 *     and Escape-to-close. Used by triggered confirms (cancel, reassign,
 *     transfer ownership, delete account). Without the lock, on touch the
 *     page behind scrolls under the dialog — fixed in this commit.
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

  useEffect(() => {
    if (!overlay) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose) {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
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
      <div className="relative mx-auto max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]">
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
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
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
