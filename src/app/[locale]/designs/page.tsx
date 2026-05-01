import { Link } from "@/i18n/navigation";

const designs = [
  {
    slug: "v1",
    title: "Editorial",
    subtitle: "Quiet confidence, serif display, near-monochrome.",
    body: "For a credible institutional feel. Typography is the hero — think Stripe homepage or New Yorker. Service colors reserved for small accents.",
    palette: ["#0f172a", "#f3eee7", "#d4c5ab"],
  },
  {
    slug: "v2",
    title: "Product-led",
    subtitle: "Dashboard-first, dense, Linear-style.",
    body: "Visible UI throughout. Hero is half product screenshot. Emphasis on 'look what you get'. Logos, testimonials, metrics front-and-center.",
    palette: ["#0f172a", "#f8fafc", "#10b981"],
  },
  {
    slug: "v3",
    title: "Brand-forward",
    subtitle: "Service colors drive composition.",
    body: "Each service becomes a colored section block. Bold, fearless, most visually distinctive. Risks louder; rewards with clear visual identity.",
    palette: ["#10b981", "#e11d48", "#f59e0b", "#0ea5e9"],
  },
];

export default function DesignsIndex() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
        Design exploration
      </p>
      <h1
        className="mt-3 font-semibold tracking-tight text-[var(--color-ink)]"
        style={{ fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.05 }}
      >
        Three directions for the Immo homepage.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-[var(--color-ink-soft)]">
        Each variant is a full homepage built against the same content — same services,
        same copy, same audience. Click through to compare. Pick one to evolve, or mix.
      </p>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {designs.map((d) => (
          <Link
            key={d.slug}
            href={`/designs/${d.slug}`}
            className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]"
          >
            <div
              className="flex h-32 items-end gap-2 p-5"
              style={{
                background: `linear-gradient(135deg, ${d.palette[0]} 0%, ${d.palette[d.palette.length - 1]} 100%)`,
              }}
            >
              {d.palette.map((c, i) => (
                <span
                  key={i}
                  className="h-5 w-5 rounded-full ring-2 ring-white/30"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex-1 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                {d.slug}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
                {d.title}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{d.subtitle}</p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                {d.body}
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-ink)] transition-colors group-hover:text-[var(--color-brand)]">
                Open preview
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-16 rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] p-6 text-sm text-[var(--color-ink-soft)]">
        <p className="font-medium text-[var(--color-ink)]">How this works</p>
        <p className="mt-2">
          These are live Next.js pages, not images. Everything uses the same components
          and design tokens as the real site, so whatever you pick can be merged back
          into production with minimal churn. Tell me which elements from which variants
          feel right and I&apos;ll evolve that into the main homepage.
        </p>
      </div>
    </main>
  );
}
