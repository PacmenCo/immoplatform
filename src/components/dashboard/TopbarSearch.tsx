"use client";

import { useEffect, useState } from "react";
import { IconSearch } from "@/components/ui/Icons";
import { CommandPalette } from "./CommandPalette";

/**
 * The topbar search input is a button that opens the command palette — we
 * don't filter inline because palette mode gives us keyboard nav + a wider
 * target list. ⌘K / Ctrl-K also opens.
 */
export function TopbarSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex w-full items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 h-9 text-sm text-[var(--color-ink-faint)] transition-colors hover:bg-[var(--color-bg)] hover:border-[var(--color-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/10"
      >
        <IconSearch size={16} className="text-[var(--color-ink-muted)]" />
        <span className="flex-1 text-left">Jump to a page…</span>
        <kbd className="hidden xl:inline-flex h-5 items-center gap-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 text-[10px] font-medium text-[var(--color-ink-muted)]">
          ⌘K
        </kbd>
      </button>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
