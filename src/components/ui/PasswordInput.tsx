"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

const fieldBase =
  "w-full h-10 pl-3 pr-10 text-sm bg-white border border-[var(--color-border-strong)] rounded-md text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] transition-colors focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/10";

type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  showToggle?: boolean;
};

function EyeIcon({ open, size = 18 }: { open: boolean; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (open) {
    return (
      <svg {...common}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a19.77 19.77 0 0 1 4.22-5.19" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a19.77 19.77 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

export function PasswordInput({
  className,
  showToggle = true,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  if (!showToggle) {
    return (
      <input
        type="password"
        className={cn(fieldBase, "pr-3", className)}
        {...props}
      />
    );
  }

  return (
    <div className="relative w-full">
      <input
        type={visible ? "text" : "password"}
        className={cn(fieldBase, className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors rounded-r-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}
