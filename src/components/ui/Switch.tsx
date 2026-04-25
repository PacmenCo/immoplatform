import { cn } from "@/lib/cn";

type SwitchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: React.ReactNode;
  description?: string;
  id: string;
};

export function Switch({
  label,
  description,
  id,
  className,
  disabled,
  ...props
}: SwitchProps) {
  const descId = description ? `${id}-desc` : undefined;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <label
        htmlFor={id}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer mt-0.5",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <input
          id={id}
          type="checkbox"
          aria-describedby={descId}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden
          className="h-6 w-11 rounded-full bg-[var(--color-border-strong)] transition-colors peer-checked:bg-[var(--color-brand)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] peer-focus-visible:ring-offset-2"
        />
        <span
          aria-hidden
          className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-[var(--color-bg)] shadow-sm transition-transform peer-checked:translate-x-5"
        />
      </label>
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
