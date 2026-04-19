import { cn } from "@/lib/cn";
import { IconCheck } from "@/components/ui/Icons";

type Variant = "error" | "success" | "info";

type FormMessageProps = {
  variant: Variant;
  children: React.ReactNode;
  className?: string;
};

function IconAlert({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function IconInfo({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

const variantStyles: Record<Variant, string> = {
  error: "text-[var(--color-asbestos)]",
  success: "text-[var(--color-epc)]",
  info: "text-[var(--color-ink-muted)]",
};

export function FormMessage({ variant, children, className }: FormMessageProps) {
  const icon =
    variant === "success" ? (
      <IconCheck size={14} />
    ) : variant === "error" ? (
      <IconAlert size={14} />
    ) : (
      <IconInfo size={14} />
    );

  return (
    <span
      role={variant === "error" ? "alert" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        variantStyles[variant],
        className,
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span>{children}</span>
    </span>
  );
}
