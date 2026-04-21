import { cn } from "@/lib/cn";

type SpinnerProps = {
  size?: number;
  className?: string;
};

/** Small circular throbber. Inherits `currentColor` so it adopts the
 *  surrounding text color wherever it's dropped in. */
export function Spinner({ size = 14, className }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("animate-spin", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
