"use client";

import { useTheme } from "./useTheme";

export function ThemeToggle({ className }: { className?: string }) {
  const { effective, setPref } = useTheme();
  const next = effective === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setPref(next)}
      aria-label={`Switch to ${next} theme`}
      aria-pressed={effective === "dark"}
      title={`Switch to ${next} theme`}
      className={
        "relative grid h-9 w-9 place-items-center rounded-md text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] " +
        (className ?? "")
      }
    >
      <SunIcon className={effective === "dark" ? "hidden" : "block"} />
      <MoonIcon className={effective === "dark" ? "block" : "hidden"} />
    </button>
  );
}

function SunIcon({ className }: { className?: string }) {
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
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
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
      className={className}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
