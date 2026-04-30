import Link from "next/link";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

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

const SPINNER_PX: Record<Size, number> = { sm: 12, md: 14, lg: 18 };

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", size = "md", loading = false, className, children, ...rest } = props;
  const cls = cn(base, "relative", variants[variant], sizes[size], loading && "cursor-wait", className);

  // Render children invisibly while loading so the button width stays exactly
  // the same as its idle state — overlay the spinner on top of the reserved
  // space. Without this trick the spinner+text combo grows the button by the
  // spinner's width on click.
  const content = loading ? (
    <>
      <span className="invisible">{children}</span>
      <span className="absolute inset-0 flex items-center justify-center">
        <Spinner size={SPINNER_PX[size]} />
      </span>
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
