"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconCheck, IconX, IconAlert } from "./Icons";

/**
 * Lightweight toast system for form-submit feedback across the dashboard.
 *
 * Public surface:
 *   const { toast } = useToast();
 *   toast.success("Saved");
 *   toast.error("Couldn't save");
 *   toast.info("…"); toast.warning("…");
 *   toast.dismiss(id);
 *
 * Architecture: a Context holds the active queue; `<Toaster>` renders it as
 * a fixed-position stack in the bottom-right corner. Auto-dismiss timers
 * live on each entry — success/info/warning self-clear after 3.5 s, error
 * holds 5.5 s. Manual dismiss via the close button returns early and kills
 * the timer.
 *
 * Accessibility: the container is a single aria-live region; errors use
 * role="alert" (assertive), other kinds use role="status" (polite). Close
 * buttons have aria-label="Dismiss notification".
 */

type ToastKind = "success" | "error" | "info" | "warning";

type ToastEntry = {
  id: string;
  kind: ToastKind;
  message: string;
  /** Action fires when the user clicks the action label inside the toast. */
  action?: { label: string; onClick: () => void };
};

type ToastContextShape = {
  entries: ToastEntry[];
  show: (e: Omit<ToastEntry, "id">) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextShape | null>(null);

/** Default auto-dismiss windows per kind (ms). */
const AUTO_DISMISS: Record<ToastKind, number> = {
  success: 3500,
  info: 3500,
  warning: 4500,
  error: 5500,
};

/** Max concurrently-visible toasts — older ones drop off the top. */
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const show = useCallback(
    (e: Omit<ToastEntry, "id">) => {
      const id = Math.random().toString(36).slice(2, 10);
      setEntries((prev) => {
        const combined = [...prev, { ...e, id }];
        if (combined.length <= MAX_VISIBLE) return combined;
        // Clear timers for the entries we're dropping so orphaned
        // setTimeouts don't linger in the Map until they self-fire.
        const popped = combined.slice(0, combined.length - MAX_VISIBLE);
        for (const p of popped) {
          const t = timers.current.get(p.id);
          if (t) {
            clearTimeout(t);
            timers.current.delete(p.id);
          }
        }
        return combined.slice(combined.length - MAX_VISIBLE);
      });
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS[e.kind]);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const t of active.values()) clearTimeout(t);
      active.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ entries, show, dismiss }}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}

/**
 * Hook — consumers call `toast.success(...)` etc.
 *
 * The returned `toast` object is memoised on `ctx.show` / `ctx.dismiss`
 * (both stable via useCallback in the provider), so it's safe to pass
 * into React effect dependency arrays without triggering re-runs on
 * every render.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  const toast = useMemo(
    () => ({
      success: (message: string, action?: ToastEntry["action"]) =>
        ctx.show({ kind: "success", message, action }),
      error: (message: string, action?: ToastEntry["action"]) =>
        ctx.show({ kind: "error", message, action }),
      info: (message: string, action?: ToastEntry["action"]) =>
        ctx.show({ kind: "info", message, action }),
      warning: (message: string, action?: ToastEntry["action"]) =>
        ctx.show({ kind: "warning", message, action }),
      dismiss: ctx.dismiss,
    }),
    [ctx.show, ctx.dismiss],
  );
  return { toast };
}

const KIND_STYLE: Record<
  ToastKind,
  { bg: string; border: string; icon: React.ElementType; role: "status" | "alert"; live: "polite" | "assertive" }
> = {
  success: {
    bg: "var(--color-bg)",
    border: "var(--color-epc)",
    icon: IconCheck,
    role: "status",
    live: "polite",
  },
  info: {
    bg: "var(--color-bg)",
    border: "var(--color-brand)",
    icon: IconAlert,
    role: "status",
    live: "polite",
  },
  warning: {
    bg: "var(--color-bg)",
    border: "var(--color-electrical)",
    icon: IconAlert,
    role: "status",
    live: "polite",
  },
  error: {
    bg: "var(--color-bg)",
    border: "var(--color-asbestos)",
    icon: IconAlert,
    role: "alert",
    live: "assertive",
  },
};

function Toaster() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:max-w-sm"
    >
      {ctx.entries.map((e) => {
        const style = KIND_STYLE[e.kind];
        const Icon = style.icon;
        return (
          <div
            key={e.id}
            role={style.role}
            aria-live={style.live}
            className="pointer-events-auto flex items-start gap-3 rounded-md border-l-4 bg-[var(--color-bg)] p-3 pr-2 shadow-lg"
            style={{ borderLeftColor: style.border, backgroundColor: style.bg }}
          >
            <span
              aria-hidden
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
              style={{ color: style.border }}
            >
              <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1 text-sm text-[var(--color-ink)]">
              <p className="break-words">{e.message}</p>
              {e.action && (
                <button
                  type="button"
                  onClick={() => {
                    e.action?.onClick();
                    ctx.dismiss(e.id);
                  }}
                  className="mt-1 text-xs font-medium underline text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                >
                  {e.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => ctx.dismiss(e.id)}
              aria-label="Dismiss notification"
              className="grid h-7 w-7 shrink-0 place-items-center rounded text-[var(--color-ink-muted)] hover:bg-[var(--color-bg-alt)] hover:text-[var(--color-ink)]"
            >
              <IconX size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
