import { cn } from "@/lib/cn";

type BadgeSize = "sm" | "md" | "lg";

const badgeSizes: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[11px] gap-1",
  md: "px-2.5 py-0.5 text-xs gap-1.5",
  lg: "px-3 py-1 text-sm gap-1.5",
};

export function Badge({
  children,
  bg,
  fg,
  size = "md",
  className,
}: {
  children: React.ReactNode;
  bg?: string;
  fg?: string;
  size?: BadgeSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        badgeSizes[size],
        className,
      )}
      style={{
        backgroundColor: bg ?? "var(--color-bg-muted)",
        color: fg ?? "var(--color-ink-soft)",
      }}
    >
      {children}
    </span>
  );
}

export function ServicePill({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
      style={{
        color: color,
        backgroundColor: `color-mix(in srgb, ${color} 14%, var(--color-bg))`,
        border: `1px solid color-mix(in srgb, ${color} 30%, var(--color-bg))`,
      }}
    >
      {label}
    </span>
  );
}
