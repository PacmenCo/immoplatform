"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  IconBell,
  IconCalendar,
  IconHome,
  IconList,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUsers,
} from "@/components/ui/Icons";

/**
 * Command palette — local-only first pass. Opens on ⌘K / Ctrl-K or by
 * clicking the topbar search trigger. Filters a static list of navigation
 * targets + quick actions; no server search yet (follow-up when the
 * assignment/user search endpoint lands).
 *
 * Platform v1 has a placeholder search icon in the header with no wired
 * handler — this replaces that with something the user can actually use.
 */

type Command = {
  id: string;
  label: string;
  hint?: string;
  href?: string;
  action?: () => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  keywords: string[];
};

const NAV_COMMANDS: Command[] = [
  { id: "nav:overview", label: "Overview", href: "/dashboard", icon: IconHome, keywords: ["home", "dashboard"] },
  { id: "nav:assignments", label: "Assignments", href: "/dashboard/assignments", icon: IconList, keywords: ["jobs", "orders", "opdrachten"] },
  { id: "new:assignment", label: "New assignment", hint: "Create", href: "/dashboard/assignments/new", icon: IconPlus, keywords: ["create", "nieuw", "+"] },
  { id: "nav:calendar", label: "Calendar", href: "/dashboard/calendar", icon: IconCalendar, keywords: ["agenda", "schedule", "kalender"] },
  { id: "nav:teams", label: "Teams", href: "/dashboard/teams", icon: IconUsers, keywords: ["agencies", "offices", "kantoor"] },
  { id: "nav:users", label: "Users", href: "/dashboard/users", icon: IconUsers, keywords: ["people", "members", "gebruikers"] },
  { id: "nav:overview_revenue", label: "Revenue overview", hint: "Financial", href: "/dashboard/overview", icon: IconList, keywords: ["financial", "money", "payments", "omzet"] },
  { id: "nav:announcements", label: "Announcements", href: "/dashboard/announcements", icon: IconBell, keywords: ["news", "mededelingen"] },
  { id: "nav:settings", label: "Settings", href: "/dashboard/settings", icon: IconSettings, keywords: ["preferences", "profile", "security"] },
];

function score(cmd: Command, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const label = cmd.label.toLowerCase();
  if (label.startsWith(q)) return 100;
  if (label.includes(q)) return 50;
  if (cmd.keywords.some((k) => k.toLowerCase().includes(q))) return 20;
  return 0;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    return NAV_COMMANDS.map((c) => ({ cmd: c, s: score(c, query) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.cmd);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, Math.max(0, results.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const hit = results[cursor];
        if (hit) run(hit);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, cursor, results]); // eslint-disable-line react-hooks/exhaustive-deps

  function run(cmd: Command) {
    onClose();
    if (cmd.href) router.push(cmd.href);
    else cmd.action?.();
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(15,23,42,0.5)] p-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-xl">
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <IconSearch size={16} className="text-[var(--color-ink-muted)]" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to… (type a page name)"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-ink-faint)]"
          />
          <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-1.5 text-[10px] font-medium text-[var(--color-ink-muted)]">
            Esc
          </kbd>
        </div>
        <ul ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-1">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-[var(--color-ink-muted)]">
              No matches.
            </li>
          ) : (
            results.map((cmd, i) => {
              const Icon = cmd.icon;
              const active = i === cursor;
              return (
                <li key={cmd.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => run(cmd)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-[var(--color-bg-muted)] text-[var(--color-ink)]"
                        : "text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-alt)]"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="flex-1 truncate">{cmd.label}</span>
                    {cmd.hint && (
                      <span className="text-xs text-[var(--color-ink-muted)]">{cmd.hint}</span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
