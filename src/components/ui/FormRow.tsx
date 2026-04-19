import { Children, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/cn";
import { FormMessage } from "@/components/ui/FormMessage";

type FormRowProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
};

type ChildWithAria = React.ReactElement<{
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}>;

function mergeDescribedBy(existing: string | undefined, extra: string | undefined) {
  if (!extra) return existing;
  if (!existing) return extra;
  return existing.includes(extra) ? existing : `${existing} ${extra}`;
}

export function FormRow({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: FormRowProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const enhancedChildren = describedBy
    ? Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        const el = child as ChildWithAria;
        const merged = mergeDescribedBy(el.props["aria-describedby"], describedBy);
        return cloneElement(el, {
          "aria-describedby": merged,
          "aria-invalid": error ? true : el.props["aria-invalid"],
        });
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-[var(--color-ink)]"
      >
        {label}
      </label>
      {enhancedChildren}
      {error ? (
        <FormMessage variant="error">
          <span id={errorId}>{error}</span>
        </FormMessage>
      ) : hint ? (
        <span id={hintId} className="text-xs text-[var(--color-ink-muted)]">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
