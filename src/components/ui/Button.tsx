import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-brand)] text-[var(--color-on-brand)] hover:bg-[var(--color-brand-soft)] hover:shadow-md",
  secondary:
    "bg-[var(--color-bg)] border border-[var(--color-border-strong)] text-[var(--color-ink)] hover:border-[var(--color-ink-soft)]",
  ghost:
    "text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]",
  danger:
    "bg-[var(--color-asbestos)] text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-sm",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

function Spinner({ size }: { size: Size }) {
  const px = size === "sm" ? 12 : size === "lg" ? 18 : 14;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", size = "md", loading = false, className, children, ...rest } = props;
  const cls = cn(base, variants[variant], sizes[size], loading && "cursor-wait", className);

  const content = loading ? (
    <>
      <Spinner size={size} />
      <span className="opacity-80">{children}</span>
    </>
  ) : (
    children
  );

  if ("href" in rest && rest.href) {
    const { href, ...anchorRest } = rest as ButtonAsLink;
    if (loading) {
      return (
        <span
          className={cls}
          role="link"
          aria-disabled="true"
          aria-busy="true"
        >
          {content}
        </span>
      );
    }
    return (
      <Link href={href} className={cls} {...anchorRest}>
        {content}
      </Link>
    );
  }
  const buttonRest = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  const disabled = buttonRest.disabled || loading;
  const ariaDisabled = buttonRest["aria-disabled"] ?? (disabled ? true : undefined);
  return (
    <button
      className={cls}
      {...buttonRest}
      disabled={disabled}
      aria-disabled={ariaDisabled}
      aria-busy={loading || undefined}
    >
      {content}
    </button>
  );
}
