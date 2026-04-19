import { Children, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/cn";

const fieldBase =
  "w-full h-10 px-3 text-sm bg-white border border-[var(--color-border-strong)] rounded-md text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] transition-colors focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/10 disabled:bg-[var(--color-bg-muted)] disabled:text-[var(--color-ink-muted)] disabled:cursor-not-allowed aria-[invalid=true]:border-[var(--color-asbestos)] aria-[invalid=true]:focus:ring-[var(--color-asbestos)]/15";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(fieldBase, "h-auto py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "appearance-none pr-8 bg-[right_0.5rem_center] bg-no-repeat", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({
  children,
  htmlFor,
  hint,
  hintId,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
  hintId?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-[var(--color-ink)]">{children}</span>
      {hint && (
        <span id={hintId} className="text-xs text-[var(--color-ink-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}

type ChildWithAria = React.ReactElement<{
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}>;

function mergeDescribedBy(existing: string | undefined, extra: string | undefined) {
  if (!extra) return existing;
  if (!existing) return extra;
  return existing.includes(extra) ? existing : `${existing} ${extra}`;
}

export function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const hintId = id && hint ? `${id}-hint` : undefined;
  const errorId = id && error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const enhancedChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const el = child as ChildWithAria;
    const patch: {
      "aria-describedby"?: string;
      "aria-invalid"?: boolean;
    } = {};
    if (describedBy && id) {
      patch["aria-describedby"] = mergeDescribedBy(
        el.props["aria-describedby"],
        describedBy,
      );
    }
    if (error) {
      patch["aria-invalid"] = true;
    }
    return Object.keys(patch).length ? cloneElement(el, patch) : el;
  });

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} hint={hint} hintId={hintId}>
        {label}
      </Label>
      {enhancedChildren}
      {error && (
        <span
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-asbestos)]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </span>
      )}
    </div>
  );
}
