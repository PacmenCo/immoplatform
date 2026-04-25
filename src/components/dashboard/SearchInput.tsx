"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { IconSearch } from "@/components/ui/Icons";
import { Spinner } from "@/components/ui/Spinner";

type Props = {
  /** Initial value, read from the URL on the server. */
  initialQuery: string;
  /** Placeholder shown when the input is empty. */
  placeholder?: string;
  /** URL param key — defaults to "q". */
  paramKey?: string;
  /** Debounce interval in ms — defaults to 250. */
  debounceMs?: number;
  /** Extra className on the wrapper label. */
  className?: string;
};

/**
 * Debounced search input that syncs its value to a URL param. All other
 * params (sort, filters, pagination) are preserved via `useSearchParams`,
 * so search stacks with existing filters instead of replacing them.
 *
 * Used by the assignments + users lists. Platform's equivalent is
 * `wire:model.live.debounce.300ms="search"` — we match the behavior at
 * 250 ms and lean on SQLite's default case-insensitive LIKE for
 * ASCII-text case folding (see assignments/page.tsx search clause).
 */
export function SearchInput({
  initialQuery,
  placeholder = "Search…",
  paramKey = "q",
  debounceMs = 250,
  className,
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

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function push(value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) sp.set(paramKey, value);
    else sp.delete(paramKey);
    const qs = sp.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function onChange(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const trimmed = value.trim();
      if (lastQueryRef.current === trimmed) return;
      lastQueryRef.current = trimmed;
      push(trimmed);
    }, debounceMs);
  }

  return (
    <label className={className ?? "relative min-w-[220px] max-w-md flex-1"}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-muted)]"
      >
        {pending ? <Spinner /> : <IconSearch size={14} />}
      </span>
      <Input
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        aria-label={placeholder}
        aria-busy={pending}
      />
    </label>
  );
}
