import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "card",
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "card" | "dashed" | "bare";
  className?: string;
}) {
  const container =
    variant === "dashed"
      ? "border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)]/40"
      : variant === "card"
        ? "border border-[var(--color-border)] bg-[var(--color-bg)]"
        : "";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-[var(--radius-lg)] px-6 py-14 text-center",
        container,
        className,
      )}
    >
      {icon && (
        <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-bg-muted)] text-[var(--color-ink-soft)] ring-4 ring-[var(--color-bg-alt)]">
          {icon}
        </span>
      )}
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-[var(--color-ink)]">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
