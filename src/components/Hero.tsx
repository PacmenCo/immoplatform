export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(15,23,42,0.08),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[var(--container)] px-6 py-24 md:py-32">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-xs font-medium text-[var(--color-ink-soft)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-epc)]" />
              4 companies. 1 platform.
            </span>

            <h1
              className="mt-6 font-semibold tracking-tight text-[var(--color-ink)]"
              style={{ fontSize: "clamp(2.5rem, 5.5vw, 4rem)", lineHeight: 1.05 }}
            >
              One platform for every real-estate certificate.
            </h1>

            <p
              className="mt-6 max-w-xl text-[var(--color-ink-soft)]"
              style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.2rem)" }}
            >
              Energy Performance Certificates, Asbestos Inventory Attests,
              Electrical Inspections and Fuel Tank Checks — ordered, tracked and
              delivered from a single dashboard. Built for real-estate agents in
              Belgium.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href="/register"
                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand)] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[var(--color-brand-soft)] hover:shadow-lg"
              >
                Register your office
                <ArrowRight />
              </a>
              <a
                href="#services"
                className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-white px-6 py-3 text-sm font-semibold text-[var(--color-ink)] transition-all hover:border-[var(--color-ink)]"
              >
                See services
              </a>
            </div>

            <p className="mt-8 text-sm text-[var(--color-ink-muted)]">
              Trusted by 400+ agents across Flanders and Brussels.
            </p>
          </div>

          <HeroPreview />
        </div>
      </div>
    </section>
  );
}

function HeroPreview() {
  const services = [
    { label: "EPC", color: "var(--color-epc)" },
    { label: "AIV", color: "var(--color-asbestos)" },
    { label: "EK", color: "var(--color-electrical)" },
    { label: "TK", color: "var(--color-fuel)" },
  ];

  return (
    <div aria-hidden className="relative hidden lg:block">
      <div
        className="absolute -inset-8 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_70%_30%,rgba(245,158,11,0.08),transparent_60%)]"
      />
      <div className="relative rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-medium tracking-wider text-[var(--color-ink-muted)]">
            ASG-2041
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-epc)_14%,white)] px-2 py-0.5 text-[11px] font-medium" style={{ color: "var(--color-epc)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-epc)]" />
            Delivered
          </span>
        </div>
        <p className="mt-4 text-[15px] font-semibold text-[var(--color-ink)]">
          Rue Belliard 12
        </p>
        <p className="text-xs text-[var(--color-ink-muted)]">1040 Brussels · Apartment, 120 m²</p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {services.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
              style={{
                color: s.color,
                backgroundColor: `color-mix(in srgb, ${s.color} 14%, white)`,
                border: `1px solid color-mix(in srgb, ${s.color} 30%, white)`,
              }}
            >
              {s.label}
            </span>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-4 text-xs">
          <div>
            <p className="text-[var(--color-ink-muted)]">Freelancer</p>
            <p className="mt-0.5 font-medium text-[var(--color-ink)]">Tim De Vries</p>
          </div>
          <div>
            <p className="text-[var(--color-ink-muted)]">Turnaround</p>
            <p className="mt-0.5 font-medium text-[var(--color-ink)] tabular-nums">4 days</p>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-6 -left-6 rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-epc)_14%,white)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-epc)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <div className="pr-1">
            <p className="text-xs font-medium text-[var(--color-ink)]">Certificate sent</p>
            <p className="text-[10px] text-[var(--color-ink-muted)]">Signed by owner · just now</p>
          </div>
        </div>
      </div>

      <div className="absolute -top-4 -right-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-brand)] p-3 text-white shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/60">This week</span>
        </div>
        <p className="mt-0.5 text-lg font-semibold tabular-nums">+23</p>
        <p className="text-[10px] text-white/60">assignments delivered</p>
      </div>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
