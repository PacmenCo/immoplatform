import Link from "next/link";
import { cn } from "@/lib/cn";

export function Modal({
  title,
  description,
  children,
  footer,
  closeHref,
  onClose,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeHref?: string;
  onClose?: () => void;
  className?: string;
}) {
  const showClose = !!closeHref || !!onClose;

  const closeIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );

  const closeBtnClass =
    "absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-md text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";

  return (
    <div
      className={cn(
        "relative rounded-[var(--radius-lg)] bg-[var(--color-bg-muted)]/60 p-6",
        className,
      )}
    >
      <div className="relative mx-auto max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-lg)]">
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
}
