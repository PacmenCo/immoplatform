"use client";

import Link from "next/link";
import { useRef, useState, useTransition, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconBuilding, IconPlus } from "@/components/ui/Icons";
import { switchActiveTeam } from "@/app/actions/auth";

export type SwitcherTeam = {
  id: string;
  name: string;
  logo: string;
  color: string;
  city: string | null;
  role: "owner" | "member";
};

export function TeamSwitcher({
  teams,
  activeId: initialActiveId,
  canCreateTeam,
}: {
  teams: SwitcherTeam[];
  activeId: string | null;
  canCreateTeam: boolean;
}) {
  // Guard against a stale activeTeamId pointing at a team the user no
  // longer belongs to — fall back to the first membership.
  const [activeId, setActiveId] = useState<string | null>(
    teams.find((t) => t.id === initialActiveId)?.id ?? teams[0]?.id ?? null,
  );
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const active = teams.find((t) => t.id === activeId) ?? null;

  if (teams.length === 0 || !active) {
    return null;
  }

  function close() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  function pickTeam(teamId: string) {
    if (teamId === activeId) {
      close();
      return;
    }
    // Optimistic: flip the UI immediately, persist server-side. router.refresh
    // re-runs the layout + page server components so the assignment scope +
    // sidebar reflect the new active team. Without this, the choice was
    // visual-only and reverted on next nav.
    setActiveId(teamId);
    close();
    startTransition(async () => {
      const res = await switchActiveTeam(teamId);
      if (!res.ok) {
        // Revert on server reject (e.g. membership stale).
        setActiveId(initialActiveId);
        return;
      }
      router.refresh();
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDetailsElement>) {
    if (e.key === "Escape" && detailsRef.current?.open) {
      close();
      const summary = detailsRef.current.querySelector("summary") as HTMLElement | null;
      summary?.focus();
    }
  }

  return (
    <details ref={detailsRef} onKeyDown={handleKeyDown} className="group relative">
      <summary
        aria-label="Switch team"
        className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md border border-transparent px-2 py-1 text-sm text-[var(--color-ink)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-alt)] [&::-webkit-details-marker]:hidden"
      >
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-[10px] font-bold text-white"
          style={{ backgroundColor: active.color }}
        >
          {active.logo}
        </span>
        <span className="max-w-[100px] truncate font-medium xl:max-w-[160px]">{active.name}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="text-[var(--color-ink-muted)] transition-transform group-open:rotate-180"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      <div className="absolute left-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-1.5 shadow-[var(--shadow-lg)]">
        <div className="px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            Acting as
          </p>
        </div>

        <ul className="max-h-80 overflow-y-auto">
          {teams.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => pickTeam(t.id)}
                disabled={pending}
                className={
                  "group/item flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-bg-muted)] disabled:opacity-60 " +
                  (t.id === activeId ? "bg-[var(--color-bg-muted)]" : "")
                }
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                  style={{ backgroundColor: t.color }}
                >
                  {t.logo}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--color-ink)]">
                    {t.name}
                  </p>
                  <p className="text-xs capitalize text-[var(--color-ink-muted)]">
                    {t.role}
                    {t.city ? ` · ${t.city}` : ""}
                  </p>
                </div>
                {t.id === activeId && (
                  <IconCheck size={14} className="text-[var(--color-brand)]" />
                )}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-1 border-t border-[var(--color-border)] pt-1">
          <Link
            href="/dashboard/teams"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
          >
            <IconBuilding size={14} />
            Manage all teams
          </Link>
          {canCreateTeam && (
            <Link
              href="/dashboard/teams/new"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
            >
              <IconPlus size={14} />
              Create a team
            </Link>
          )}
        </div>
      </div>
    </details>
  );
}
