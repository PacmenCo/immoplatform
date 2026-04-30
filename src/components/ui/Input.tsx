import { Children, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/cn";

const fieldBase =
  "w-full h-10 px-3 text-sm bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-md text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] transition-colors focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/10 disabled:bg-[var(--color-bg-muted)] disabled:text-[var(--color-ink-muted)] disabled:cursor-not-allowed aria-[invalid=true]:border-[var(--color-asbestos)] aria-[invalid=true]:focus:ring-[var(--color-asbestos)]/15";

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
  required,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
  hintId?: string;
  required?: boolean;
}) {
  // The hint must sit OUTSIDE <label> so it does not pollute the label's
  // accessible name (a11y audit flagged "Invoice recipientParticulier = …"
  // run-on labels). Visual layout is preserved by wrapping in a flex column;
  // <p>/<span aria-hidden> on the asterisk keeps SR output to just `children`.
  // Required indication is conveyed via the input's `required` attribute (set
  // by the caller on the <Input>/<Select>), which screen readers announce.
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor={htmlFor} className="font-medium text-[var(--color-ink)]">
        {children}
        {required && (
          <>
            <span aria-hidden="true" className="ml-0.5 text-[var(--color-asbestos)]">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-[var(--color-ink-muted)]">
          {hint}
        </p>
      )}
    </div>
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
  required,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  id?: string;
  required?: boolean;
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
    // `mt-auto` on the input wrapper aligns inputs at the row's bottom edge
    // when sibling Fields share a grid row but have different label/hint
    // heights (e.g. one-line vs two-line hints). In non-grid / equal-height
    // contexts there's no extra space, so mt-auto is a no-op.
    <div className="flex h-full flex-col gap-2">
      <Label htmlFor={id} hint={hint} hintId={hintId} required={required}>
        {label}
      </Label>
      <div className="mt-auto flex flex-col gap-2">
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
    </div>
  );
}
