export default function CTA() {
  return (
    <section className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
      <div className="mx-auto max-w-[var(--container)] px-6 py-24">
        <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg)] p-12 md:p-16 text-center shadow-[var(--shadow-md)]">
          <div
            aria-hidden
            className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-[radial-gradient(circle,var(--color-accent)_0%,transparent_65%)] opacity-10 blur-2xl"
          />
          <div
            aria-hidden
            className="absolute -left-32 -bottom-32 h-80 w-80 rounded-full bg-[radial-gradient(circle,var(--color-epc)_0%,transparent_65%)] opacity-10 blur-2xl"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2
              className="font-semibold tracking-tight"
              style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.75rem)", lineHeight: 1.1 }}
            >
              Ready to simplify your workflow?
            </h2>
            <p className="mt-4 text-lg text-[var(--color-ink-soft)]">
              Set up your agency in minutes. First assignment on us.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="/register"
                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand)] px-6 py-3 text-sm font-semibold text-[var(--color-on-brand)] transition-all hover:bg-[var(--color-brand-soft)] hover:shadow-lg"
              >
                Register your office
              </a>
              <a
                href="/demo"
                className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] px-6 py-3 text-sm font-semibold text-[var(--color-ink)] transition-all hover:border-[var(--color-ink)]"
              >
                Book a demo
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
