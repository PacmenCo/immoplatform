import Link from "next/link";

type Props = {
  /** 1-indexed current page. */
  current: number;
  /** Total row count across all pages. */
  total: number;
  /** Page size — fixed at 20 to mirror v1 (Platform/AssignmentsList.php:294). */
  pageSize: number;
  /**
   * Build a URL preserving every other filter/sort param while overriding
   * `?page=N`. Caller wires this from page.tsx so we share the canonicalized
   * URL builder (no duplicate logic).
   */
  buildUrl: (page: number) => string;
};

/**
 * Numeric pagination strip rendered below the assignments table. Mirrors v1's
 * Livewire `$assignments->links()` (livewire/assignments-list.blade.php:572).
 *
 * Renders nothing when `total <= pageSize` — single-page lists shouldn't get a
 * "Page 1 of 1" footer. For >10 pages we condense the strip to
 * `1 … (current-1) (current) (current+1) … last`; otherwise we show every page.
 *
 * Server component on purpose: every link target is determined by the URL
 * params already on the request, no client state needed.
 */
export function Pagination({ current, total, pageSize, buildUrl }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const prevDisabled = current <= 1;
  const nextDisabled = current >= totalPages;
  const pages = pageNumbers(current, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 px-1"
    >
      <p className="text-xs text-[var(--color-ink-muted)]">
        Page {current} of {totalPages} · {total} assignments total
      </p>

      <ul className="inline-flex items-center gap-1">
        <li>
          <PageLink
            href={buildUrl(Math.max(1, current - 1))}
            disabled={prevDisabled}
            aria-label="Previous page"
            rel="prev"
          >
            Prev
          </PageLink>
        </li>

        {pages.map((p, i) =>
          p === "…" ? (
            <li key={`ellipsis-${i}`} aria-hidden>
              <span className="px-2 text-xs text-[var(--color-ink-faint)]">…</span>
            </li>
          ) : (
            <li key={p}>
              <PageLink
                href={buildUrl(p)}
                active={p === current}
                aria-label={`Page ${p}`}
                aria-current={p === current ? "page" : undefined}
              >
                {p}
              </PageLink>
            </li>
          ),
        )}

        <li>
          <PageLink
            href={buildUrl(Math.min(totalPages, current + 1))}
            disabled={nextDisabled}
            aria-label="Next page"
            rel="next"
          >
            Next
          </PageLink>
        </li>
      </ul>
    </nav>
  );
}

/**
 * Build the page strip. ≤10 pages: show all. Otherwise: `1, …, c-1, c, c+1, …, last`
 * (with the ellipsis collapsing only when there's a real gap).
 */
function pageNumbers(current: number, total: number): Array<number | "…"> {
  if (total <= 10) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const out: Array<number | "…"> = [];
  const window = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...window].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    out.push(sorted[i]);
    const next = sorted[i + 1];
    if (next !== undefined && next - sorted[i] > 1) out.push("…");
  }
  return out;
}

type PageLinkProps = {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  rel?: "prev" | "next";
} & Pick<React.AriaAttributes, "aria-label" | "aria-current">;

function PageLink({ href, children, active, disabled, rel, ...aria }: PageLinkProps) {
  const className =
    "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-xs font-semibold transition-colors " +
    (active
      ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-[var(--color-on-brand)]"
      : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink-soft)] hover:text-[var(--color-ink)]");

  if (disabled) {
    return (
      <span
        className={className + " pointer-events-none opacity-40"}
        aria-disabled="true"
        {...aria}
      >
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} rel={rel} {...aria}>
      {children}
    </Link>
  );
}
