"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input, Select } from "@/components/ui/Input";
import { IconSearch } from "@/components/ui/Icons";
import { Spinner } from "@/components/ui/Spinner";
import { STATUS_META, type Status } from "@/lib/mockData";

type Team = { id: string; name: string };

type Props = {
  initialQuery: string;
  initialStatus: Status | null;
  initialTeam: string;
  canPickTeam: boolean;
  teams: Team[];
  /** Render a "Reset" link on the right when any filter is active. */
  resetHref: string;
  showReset: boolean;
};

const STATUS_ORDER: Status[] = [
  "draft",
  "scheduled",
  "in_progress",
  "delivered",
  "completed",
  "cancelled",
];

/**
 * Unified filter toolbar: search + status + team on one row. Each change
 * updates the URL; the server-rendered list re-fetches with the new query.
 *
 * Typing debounces at 250 ms; status / team apply on change. Other URL
 * params (sort, dir) are preserved via `useSearchParams`, so sort + filter
 * stack cleanly.
 */
export function FiltersBar({
  initialQuery,
  initialStatus,
  initialTeam,
  canPickTeam,
  teams,
  resetHref,
  showReset,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  const [query, setQuery] = useState(initialQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef(initialQuery);

  useEffect(() => {
    lastQueryRef.current = initialQuery;
    setQuery(initialQuery);
  }, [initialQuery]);

  // Cancel any pending debounce when the component unmounts so we don't
  // trigger a router.replace after remount.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function push(patch: { q?: string; status?: Status | ""; team?: string }) {
    const sp = new URLSearchParams(searchParams.toString());
    if ("q" in patch) {
      if (patch.q) sp.set("q", patch.q);
      else sp.delete("q");
    }
    if ("status" in patch) {
      if (patch.status) sp.set("status", patch.status);
      else sp.delete("status");
    }
    if ("team" in patch) {
      if (patch.team) sp.set("team", patch.team);
      else sp.delete("team");
    }
    const qs = sp.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function onQueryChange(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (lastQueryRef.current === value) return;
      lastQueryRef.current = value;
      push({ q: value.trim() });
    }, 250);
  }

  return (
    <div className="flex flex-1 flex-wrap items-center gap-2">
      <label className="relative min-w-[220px] max-w-md flex-1">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-muted)]"
        >
          {pending ? <Spinner /> : <IconSearch size={14} />}
        </span>
        <Input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search reference, address, team, person…"
          className="pl-9"
          aria-busy={pending}
        />
      </label>

      {/* Filter group — pushed to the right so the row mirrors Platform's
          layout (search left, filters right, action buttons after).
          Fixed-width wrappers because our Select base is `w-full`, which
          flex-basis-wise blows the row out without an explicit width. */}
      <div className="ml-auto flex items-center gap-2">
        <div className="w-[200px] shrink-0">
          <Select
            value={initialStatus ?? ""}
            onChange={(e) => push({ status: (e.target.value as Status | "") || "" })}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </div>

        {canPickTeam && teams.length > 0 && (
          <div className="w-[200px] shrink-0">
            <Select
              value={initialTeam}
              onChange={(e) => push({ team: e.target.value })}
              aria-label="Filter by team"
            >
              <option value="">All teams</option>
              <option value="none">— No team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {showReset && (
          <a
            href={resetHref}
            className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            Reset
          </a>
        )}
      </div>
    </div>
  );
}

