"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function RootError({
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
    <div className="grid min-h-screen place-items-center bg-[var(--color-bg-alt)] px-6">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-8 text-center shadow-[var(--shadow-md)]">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-asbestos)_12%,white)] text-[var(--color-asbestos)]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            className="h-6 w-6"
          >
            <path d="M12 9v4" strokeLinecap="round" />
            <path d="M12 17h.01" strokeLinecap="round" />
            <path
              d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-[var(--color-ink)]">
          Something went wrong
        </h1>
        <p className="mb-6 text-sm text-[var(--color-ink-muted)]">
          An unexpected error occurred. You can try again, or head back to the homepage.
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
          <Button variant="secondary" href="/">
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
