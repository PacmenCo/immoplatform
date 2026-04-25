"use client";

import { useEffect } from "react";

/**
 * Last-resort fallback when the ROOT layout itself throws — Tailwind comes
 * via globals.css from the layout that just blew up, so we can't rely on
 * any CSS class or design token here. Inline styles only, no token vars.
 *
 * Per-segment errors (a child page throws) flow through `app/error.tsx`
 * instead, which renders inside the working root layout and uses the full
 * design system. This file is the catastrophic-only branch.
 */
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          backgroundColor: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            padding: 32,
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            textAlign: "center",
            boxShadow: "0 4px 12px -2px rgb(15 23 42 / 0.06)",
          }}
        >
          <div
            style={{
              margin: "0 auto 20px",
              display: "grid",
              placeItems: "center",
              height: 48,
              width: 48,
              borderRadius: 9999,
              background: "#fee2e2",
              color: "#b91c1c",
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              style={{ height: 24, width: 24 }}
            >
              <path d="M12 9v4" strokeLinecap="round" />
              <path d="M12 17h.01" strokeLinecap="round" />
              <path
                d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>
            The application hit an unexpected error. Try again, or head back to
            the homepage.
          </p>
          {error.digest && (
            <p
              style={{
                margin: "0 0 24px",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 12,
                color: "#94a3b8",
              }}
            >
              ref: {error.digest}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                appearance: "none",
                border: "none",
                background: "#0f172a",
                color: "#ffffff",
                padding: "10px 18px",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                background: "#ffffff",
                color: "#0f172a",
                padding: "10px 18px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
