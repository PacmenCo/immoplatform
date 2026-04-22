"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

export type ByTeamSort = "team" | "assignments" | "revenue" | "commission";

type Props = {
  id: ByTeamSort;
  label: string;
  currentSort: ByTeamSort;
  currentDir: "asc" | "desc";
  align?: "left" | "right";
};

/**
 * A sortable table header that writes `sort` + `dir` onto the URL, preserving
 * all other query params (period, team filter, etc). Mirrors Platform's
 * wire:click="sortBy('<field>')" behavior — flips direction if the same
 * column is clicked, resets to a fresh desc otherwise.
 */
export function ByTeamSortHeader({ id, label, currentSort, currentDir, align = "left" }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isActive = currentSort === id;
  // Default: clicking an inactive column = sort desc (except "team", which
  // starts asc because alphabetical-descending is weird). Active column flips.
  const defaultDir: "asc" | "desc" = id === "team" ? "asc" : "desc";
  const nextDir: "asc" | "desc" = isActive
    ? currentDir === "desc"
      ? "asc"
      : "desc"
    : defaultDir;

  const sp = new URLSearchParams(searchParams.toString());
  sp.set("sort", id);
  sp.set("dir", nextDir);
  // Keep the URL tidy — drop defaults so the canonical share-URL is short.
  if (id === "revenue" && nextDir === "desc") {
    sp.delete("sort");
    sp.delete("dir");
  }
  const href = `${pathname}${sp.toString() ? `?${sp}` : ""}`;

  const alignCls = align === "right" ? "text-right justify-end" : "text-left";

  return (
    <th className={`px-6 py-3 font-semibold ${alignCls}`}>
      <Link
        href={href}
        scroll={false}
        className={
          "inline-flex items-center gap-1 uppercase tracking-wider " +
          (isActive ? "text-[var(--color-ink)]" : "hover:text-[var(--color-ink)]")
        }
      >
        {label}
        <SortArrow active={isActive} dir={currentDir} />
      </Link>
    </th>
  );
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) {
    return (
      <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className="opacity-40">
        <path
          d="M3 4l2-2 2 2M3 6l2 2 2-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg aria-hidden width="10" height="10" viewBox="0 0 10 10">
      {dir === "asc" ? (
        <path d="M3 6l2-2 2 2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M3 4l2 2 2-2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
