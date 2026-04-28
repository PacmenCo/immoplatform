import Link from "next/link";

const LINKS = [
  { href: "/#services", label: "Services" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#about", label: "About" },
  { href: "/demo", label: "Request a demo" },
  { href: "/contact", label: "Contact" },
];

export function MobileNav() {
  return (
    <details className="relative md:hidden group">
      <summary
        className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-md text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)] [&::-webkit-details-marker]:hidden"
        aria-label="Open menu"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="block group-open:hidden"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="hidden group-open:block"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </summary>

      <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2 shadow-[var(--shadow-lg)]">
        <ul className="flex flex-col">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="flex min-h-11 items-center justify-between rounded-md px-3 py-2 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-2 border-t border-[var(--color-border)] pt-2">
          <Link
            href="/login"
            className="flex min-h-11 items-center justify-between rounded-md px-3 py-2 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="mt-1 flex min-h-11 items-center justify-center rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-[var(--color-on-brand)] transition-colors hover:bg-[var(--color-brand-soft)]"
          >
            Register as agent
          </Link>
        </div>
      </div>
    </details>
  );
}
