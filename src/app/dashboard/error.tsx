"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--color-bg-alt)]">
      <header className="hidden h-16 items-center justify-between border-b border-[var(--color-border)] bg-white px-6 xl:px-8 lg:flex">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-[var(--color-ink)]">
            Dashboard
          </h1>
          <p className="truncate text-xs text-[var(--color-ink-muted)]">
            Something broke while loading this view
          </p>
        </div>
      </header>

      <div className="grid place-items-center px-6 py-16">
        <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-8 text-center shadow-[var(--shadow-sm)]">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-asbestos)_12%,white)] text-[var(--color-asbestos)]">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              className="h-6 w-6"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4" strokeLinecap="round" />
              <path d="M12 16h.01" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-[var(--color-ink)]">
            We hit a snag loading this page
          </h2>
          <p className="mb-6 text-sm text-[var(--color-ink-muted)]">
            Your session is still active. Try reloading the section, or return to the
            dashboard overview.
          </p>
          {error.digest && (
            <p className="mb-6 font-mono text-xs text-[var(--color-ink-faint)]">
              ref: {error.digest}
            </p>
          )}
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button variant="primary" onClick={() => reset()}>
              Try again
            </Button>
            <Button variant="secondary" href="/dashboard">
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
