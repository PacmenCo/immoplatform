import { cn } from "@/lib/cn";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: React.ReactNode;
  description?: string;
  id: string;
};

export function Checkbox({
  label,
  description,
  id,
  className,
  ...props
}: CheckboxProps) {
  const descId = description ? `${id}-desc` : undefined;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        aria-describedby={descId}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg)] accent-[var(--color-brand)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
        {...props}
      />
      <label htmlFor={id} className="flex flex-col gap-0.5 text-sm cursor-pointer select-none">
        <span className="font-medium text-[var(--color-ink)]">{label}</span>
        {description && (
          <span id={descId} className="text-xs text-[var(--color-ink-muted)]">
            {description}
          </span>
        )}
      </label>
    </div>
  );
}
