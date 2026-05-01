import { Link } from "@/i18n/navigation";

const variants = [
  { slug: "", label: "Overview" },
  { slug: "v1", label: "v1 — Editorial" },
  { slug: "v2", label: "v2 — Product-led" },
  { slug: "v3", label: "v3 — Brand-forward" },
];

export default function DesignsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-1 px-4 text-xs">
          <Link
            href="/"
            className="mr-2 inline-flex items-center gap-1 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            ←<span>Back to site</span>
          </Link>
          <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />
          {variants.map((v) => (
            <Link
              key={v.slug}
              href={`/designs${v.slug ? `/${v.slug}` : ""}`}
              className="rounded-md px-2.5 py-1 font-medium text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
            >
              {v.label}
            </Link>
          ))}
          <span className="ml-auto text-[var(--color-ink-muted)]">Design preview · not production</span>
        </div>
      </nav>
      {children}
    </div>
  );
}
