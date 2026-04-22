import { cn } from "@/lib/cn";

const sizeMap = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl ring-4 ring-white",
};

const palette = [
  "#0f172a",
  "#1e40af",
  "#0d9488",
  "#9f1239",
  "#b45309",
  "#6d28d9",
  "#155e75",
  "#365314",
];

function hashColor(initials: string) {
  let sum = 0;
  for (const c of initials) sum += c.charCodeAt(0);
  return palette[sum % palette.length];
}

export function Avatar({
  initials,
  imageUrl,
  alt,
  size = "md",
  color,
  online,
  className,
}: {
  initials: string;
  imageUrl?: string | null;
  /** Alt text when `imageUrl` is set — prefer a full name over initials. */
  alt?: string;
  size?: keyof typeof sizeMap;
  color?: string;
  online?: boolean;
  className?: string;
}) {
  const bg = color ?? hashColor(initials);
  return (
    <span className={cn("relative inline-block", className)}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt ?? initials}
          className={cn(
            "rounded-full object-cover bg-[var(--color-bg-muted)]",
            sizeMap[size],
          )}
        />
      ) : (
        <span
          className={cn(
            "grid place-items-center rounded-full text-white font-semibold",
            sizeMap[size],
          )}
          style={{ backgroundColor: bg }}
        >
          {initials.slice(0, 2)}
        </span>
      )}
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full border-2 border-white",
            online ? "bg-[var(--color-epc)]" : "bg-[var(--color-ink-faint)]",
          )}
          aria-label={online ? "online" : "offline"}
        />
      )}
    </span>
  );
}
