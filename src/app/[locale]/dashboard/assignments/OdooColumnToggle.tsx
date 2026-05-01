"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Per-browser admin-only toggle that controls whether the Odoo sync
 * column on the assignments list is visible. Default: hidden.
 *
 * Mechanism: writes a `data-show-odoo` attribute on `<html>` so a CSS
 * rule in globals.css can show/hide the `.odoo-col` cells without re-
 * rendering the table. localStorage persists across navigations.
 *
 * The page only renders this toggle (and the column markup) when the
 * viewer has the `admin` role — staff / realtor / freelancer never see
 * the column at all, regardless of localStorage state.
 */
const KEY = "immo:showOdooColumn";

export function OdooColumnToggle() {
  const t = useTranslations("dashboard.assignments.list");
  // Default false matches the SSR-rendered CSS state (hidden), so there's
  // no flash of the column on first paint when an admin hasn't toggled it on.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY) === "1";
    setShown(stored);
    document.documentElement.dataset.showOdoo = stored ? "1" : "0";
  }, []);

  function toggle() {
    const next = !shown;
    setShown(next);
    window.localStorage.setItem(KEY, next ? "1" : "0");
    document.documentElement.dataset.showOdoo = next ? "1" : "0";
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={shown}
      title={shown ? t("hideOdooTitle") : t("showOdooTitle")}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 h-9 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)] transition-colors"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {shown ? (
          // eye-off
          <>
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </>
        ) : (
          // eye
          <>
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </>
        )}
      </svg>
      {shown ? t("hideOdoo") : t("showOdoo")}
    </button>
  );
}
