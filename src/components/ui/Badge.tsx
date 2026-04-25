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
  // Mix the foreground brand color with --color-ink so the text deepens to
  // a readable contrast against the 14% tinted bg. The raw `${color}`
  // foreground (prior code) failed WCAG AA — measured 1.93:1 on the
  // electrical-amber pill against its tint. Mixing 60% brand + 40% ink
  // pushes every service color past 4.5:1 in both light and dark mode
  // while preserving brand recognition.
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
      style={{
        color: `color-mix(in srgb, ${color} 60%, var(--color-ink))`,
        backgroundColor: `color-mix(in srgb, ${color} 14%, var(--color-bg))`,
        border: `1px solid color-mix(in srgb, ${color} 30%, var(--color-bg))`,
      }}
    >
      {label}
    </span>
  );
}
