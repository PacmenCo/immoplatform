"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type SearchSelectOption = {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
};

type Props = {
  /** Name of the hidden input — the value is what submits with a <form>. */
  name?: string;
  /** Controlled selected value (empty string = nothing selected). */
  value: string;
  onChange: (value: string) => void;

  options: SearchSelectOption[];

  /** Label on the closed trigger when nothing is selected. */
  placeholder?: string;
  /** Placeholder inside the search input when the dropdown is open. */
  searchPlaceholder?: string;
  /** If set, renders a "clear" row at the top of the list (e.g. "— No team —"). */
  clearOptionLabel?: string;

  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  /** Label to render above the trigger, with optional leading icon. */
  label?: string;
  labelIcon?: React.ReactNode;
  /** Help text below the label. */
  hint?: string;
};

export function SearchSelect({
  name,
  value,
  onChange,
  options,
  placeholder = "Choose an option",
  searchPlaceholder = "Search…",
  clearOptionLabel,
  disabled = false,
  required = false,
  id,
  className,
  label,
  labelIcon,
  hint,
}: Props) {
  const generatedId = useId();
  const triggerId = id ?? `ss-${generatedId}`;
  const listboxId = `${triggerId}-listbox`;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  // Client-side filter: case-insensitive match on label + sublabel
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter((o) => {
      const hay = (o.label + " " + (o.sublabel ?? "")).toLowerCase();
      return hay.includes(q);
    });
  }, [options, search]);

  // Keep highlighted index in range when filter changes
  useEffect(() => {
    setActiveIdx(0);
  }, [search, open]);

  // Click-away to close
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open) {
      // slight delay so the input is mounted
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  // Total rows including the optional "clear" row at index 0
  const hasClearRow = !!clearOptionLabel;
  const rowCount = filtered.length + (hasClearRow ? 1 : 0);

  function pickAt(idx: number) {
    if (hasClearRow && idx === 0) {
      onChange("");
    } else {
      const opt = filtered[idx - (hasClearRow ? 1 : 0)];
      if (opt) onChange(opt.value);
    }
    setOpen(false);
    setSearch("");
    triggerRef.current?.focus();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setSearch("");
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(rowCount - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIdx(rowCount - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pickAt(activeIdx);
    }
  }

  const triggerText = selectedOption
    ? selectedOption.label
    : hasClearRow && value === ""
      ? placeholder
      : placeholder;

  return (
    <div ref={rootRef} className={cn("relative w-full", className)} onKeyDown={handleKey}>
      {label && (
        <label
          htmlFor={triggerId}
          className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]"
        >
          {labelIcon && (
            <span className="text-[var(--color-ink-muted)]" aria-hidden>
              {labelIcon}
            </span>
          )}
          {label}
          {required && (
            <span aria-hidden className="text-[var(--color-asbestos)]">
              *
            </span>
          )}
        </label>
      )}
      {hint && !label && (
        <p className="mb-1.5 text-xs text-[var(--color-ink-muted)]">{hint}</p>
      )}

      {/* Hidden native input so parent <form> submissions carry the value */}
      {name && <input type="hidden" name={name} value={value} required={required} />}

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-activedescendant={
          open ? `${triggerId}-opt-${activeIdx}` : undefined
        }
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "w-full h-10 text-left flex items-center gap-2 rounded-md border bg-[var(--color-bg)] px-3 text-sm transition-colors",
          open
            ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/15"
            : "border-[var(--color-border-strong)] hover:border-[var(--color-ink-soft)]",
          disabled && "cursor-not-allowed opacity-60",
          !selectedOption && "text-[var(--color-ink-faint)]",
        )}
      >
        {selectedOption?.icon && (
          <span className="shrink-0 text-[var(--color-ink-muted)]">
            {selectedOption.icon}
          </span>
        )}
        <span className="flex-1 truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        {selectedOption && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear selection"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="grid h-5 w-5 place-items-center rounded text-[var(--color-ink-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </span>
        )}
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
          className={cn(
            "shrink-0 text-[var(--color-ink-muted)] transition-transform",
            open && "rotate-180",
          )}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]">
          {/* Search */}
          <div className="border-b border-[var(--color-border)] p-2">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[var(--color-ink-muted)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  // Prevent the parent's onKeyDown from stealing text entry;
                  // but still handle navigation keys.
                  if (["Escape", "ArrowDown", "ArrowUp", "Enter", "Home", "End"].includes(e.key)) {
                    return; // parent handler does these
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full h-8 rounded bg-[var(--color-bg-alt)] pl-7 pr-2 text-sm placeholder:text-[var(--color-ink-faint)] focus:bg-[var(--color-bg)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]/20"
              />
            </div>
          </div>

          {/* Options */}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="max-h-64 overflow-auto py-1 text-sm"
          >
            {/* Clear row */}
            {hasClearRow && (
              <Row
                idx={0}
                id={`${triggerId}-opt-0`}
                isActive={activeIdx === 0}
                isSelected={value === ""}
                onMouseEnter={() => setActiveIdx(0)}
                onClick={() => pickAt(0)}
                muted
                italic
              >
                {clearOptionLabel}
              </Row>
            )}

            {filtered.length === 0 && !hasClearRow && (
              <li className="px-3 py-2 text-[var(--color-ink-muted)]">No results</li>
            )}
            {filtered.length === 0 && hasClearRow && (
              <li className="px-3 py-2 text-[var(--color-ink-muted)]">No matches</li>
            )}

            {filtered.map((o, i) => {
              const idx = hasClearRow ? i + 1 : i;
              return (
                <Row
                  key={o.value}
                  idx={idx}
                  id={`${triggerId}-opt-${idx}`}
                  isActive={activeIdx === idx}
                  isSelected={o.value === value}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => pickAt(idx)}
                >
                  {o.icon && (
                    <span className="shrink-0 text-[var(--color-ink-muted)]">
                      {o.icon}
                    </span>
                  )}
                  <span className="flex-1 truncate">
                    <span className="text-[var(--color-ink)]">{o.label}</span>
                    {o.sublabel && (
                      <span className="ml-2 text-xs text-[var(--color-ink-muted)]">
                        {o.sublabel}
                      </span>
                    )}
                  </span>
                  {o.value === value && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      className="text-[var(--color-brand)]"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </Row>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({
  id,
  idx,
  isActive,
  isSelected,
  onMouseEnter,
  onClick,
  muted,
  italic,
  children,
}: {
  id: string;
  idx: number;
  isActive: boolean;
  isSelected: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  muted?: boolean;
  italic?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      id={id}
      data-idx={idx}
      role="option"
      aria-selected={isSelected}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors",
        isActive && "bg-[var(--color-bg-muted)]",
        isSelected &&
          "bg-[color-mix(in_srgb,var(--color-brand)_6%,var(--color-bg))] text-[var(--color-brand)]",
        muted && "text-[var(--color-ink-muted)]",
        italic && "italic",
      )}
    >
      {children}
    </li>
  );
}
