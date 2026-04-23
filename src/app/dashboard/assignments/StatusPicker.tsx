"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/Badge";
import { STATUS_META, STATUS_ORDER, type Status } from "@/lib/mockData";
import { allowedTargetsForRole } from "@/lib/assignmentStatus";
import type { Role } from "@/lib/permissions.types";
import { changeAssignmentStatus } from "@/app/actions/assignments";

type Props = {
  assignmentId: string;
  status: Status;
  /**
   * The viewer's role — drives which targets are offered in the menu.
   * Platform hides disallowed statuses in blade; we match client-side.
   * Server still re-checks via `canRoleTransitionTo`.
   */
  role: Role;
};

/**
 * Inline status editor on the assignments list.
 *
 * Allows any status change — forward through the lifecycle or backwards
 * (undo an accidental complete/cancel). The menu is portaled to
 * `document.body` so parent `overflow-*` can't clip it.
 */
export function StatusPicker({ assignmentId, status, role }: Props) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const meta = STATUS_META[status];

  // Keep the canonical STATUS_ORDER, but filter down to what the viewer's
  // role can actually reach. `allowedTargetsForRole` always includes the
  // current status so the list never renders empty.
  const options = useMemo(() => {
    const allowed = new Set<Status>(allowedTargetsForRole(role, status));
    return STATUS_ORDER.filter((s) => allowed.has(s));
  }, [role, status]);

  // Position the menu underneath the trigger whenever it opens. Re-measures
  // on scroll/resize so the menu follows the cell instead of drifting.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function measure() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 160),
      });
    }
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  // Close on outside click / Escape. Also clear any stale error the next
  // time the menu opens — keeping it around would misrepresent the current
  // state of the row.
  useEffect(() => {
    if (!open) return;
    setError(null);
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(to: Status) {
    setError(null);
    setOpen(false);
    start(async () => {
      const res = await changeAssignmentStatus(assignmentId, { to });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full border border-transparent hover:border-[var(--color-border-strong)] transition-colors disabled:opacity-60"
      >
        <Badge bg={meta.bg} fg={meta.fg}>{meta.label}</Badge>
        <svg
          aria-hidden
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className="text-[var(--color-ink-muted)]"
        >
          <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: pos.width }}
            className="z-50 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] py-1 shadow-lg"
          >
            {options.map((s) => {
              const m = STATUS_META[s];
              const isCurrent = s === status;
              return (
                <li key={s}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    disabled={isCurrent}
                    onClick={() => pick(s)}
                    className={
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm " +
                      (isCurrent
                        ? "cursor-not-allowed text-[var(--color-ink-faint)]"
                        : "text-[var(--color-ink)] hover:bg-[var(--color-bg-alt)]")
                    }
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: m.fg }}
                    />
                    <span className="flex-1">{m.label}</span>
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                        current
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )}

      {error && (
        <p
          role="alert"
          className="absolute left-0 top-full mt-1 whitespace-nowrap rounded bg-[var(--color-asbestos)] px-2 py-1 text-[10px] font-medium text-white"
        >
          {error}
        </p>
      )}
    </div>
  );
}
