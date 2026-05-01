import { Link } from "@/i18n/navigation";

const services = [
  { code: "EPC", color: "var(--color-epc)" },
  { code: "AIV", color: "var(--color-asbestos)" },
  { code: "EK", color: "var(--color-electrical)" },
  { code: "TK", color: "var(--color-fuel)" },
];

export default function ProductLedVariant() {
  return (
    <main className="bg-[var(--color-bg-alt)] text-[var(--color-ink)]">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(15,23,42,0.06),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-[1300px] px-6 py-20 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-epc)] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-epc)]" />
                </span>
                Now onboarding Belgian agencies
              </div>

              <h1
                className="mt-7 font-semibold tracking-tight"
                style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.02, letterSpacing: "-0.025em" }}
              >
                The command center for real-estate certifications.
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--color-ink-soft)]">
                One dashboard to order EPC, AIV, EK and TK inspections. Track every
                assignment, every file, every deadline — from listing to signature.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-5 text-sm font-semibold text-white transition-all hover:bg-[var(--color-brand-soft)] hover:shadow-lg"
                >
                  Start free →
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-white px-5 text-sm font-semibold transition-colors hover:border-[var(--color-ink)]"
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-brand)] text-white">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  Watch 2-min demo
                </Link>
              </div>

              <div className="mt-10 flex items-center gap-4 text-xs text-[var(--color-ink-muted)]">
                <div className="flex -space-x-2">
                  {["#0f172a", "#1e40af", "#0d9488", "#9f1239"].map((c) => (
                    <span
                      key={c}
                      className="h-7 w-7 rounded-full border-2 border-[var(--color-bg-alt)]"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <span>
                  <strong className="text-[var(--color-ink)]">400+ agencies</strong> ·
                  12,000 certificates issued
                </span>
              </div>
            </div>

            {/* Product mockup */}
            <ProductShot />
          </div>
        </div>

        {/* Logo strip */}
        <div className="relative border-t border-[var(--color-border)] bg-white">
          <div className="mx-auto flex max-w-[1300px] flex-wrap items-center justify-center gap-x-12 gap-y-4 px-6 py-8 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-faint)]">
            <span>Trusted by</span>
            <span className="text-[var(--color-ink-soft)]">Vastgoed Antwerp</span>
            <span className="text-[var(--color-ink-soft)]">Immo Bruxelles</span>
            <span className="text-[var(--color-ink-soft)]">Gent Huizen</span>
            <span className="text-[var(--color-ink-soft)]">Mechelen Makelaars</span>
            <span className="text-[var(--color-ink-soft)]">Brugge Vastgoed</span>
          </div>
        </div>
      </section>

      {/* Feature grid with UI chips */}
      <section className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto max-w-[1300px] px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
              The product
            </p>
            <h2
              className="mt-3 font-semibold tracking-tight"
              style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.5rem)", lineHeight: 1.1 }}
            >
              Everything between a listing and a signed deed.
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="Order any service, any combination"
              body="Tick EPC, AIV, EK or TK on one form. We route to the right inspector, no re-entry."
              mock={
                <div className="space-y-2">
                  {services.map((s) => (
                    <div
                      key={s.code}
                      className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2"
                    >
                      <span className="h-4 w-4 rounded border border-[var(--color-border-strong)] bg-white" />
                      <span className="text-xs font-semibold" style={{ color: s.color }}>
                        {s.code}
                      </span>
                      <span className="text-xs text-[var(--color-ink-soft)]">
                        Service
                      </span>
                    </div>
                  ))}
                </div>
              }
            />
            <FeatureCard
              title="Real-time status, per assignment"
              body="Every assignment is a single page with property, contacts, files, and a live timeline."
              mock={
                <div className="space-y-2 text-xs">
                  <StatusPill label="Scheduled" color="#1d4ed8" />
                  <StatusPill label="In progress" color="#b45309" />
                  <StatusPill label="Delivered" color="#15803d" />
                </div>
              }
            />
            <FeatureCard
              title="One invoice, bundled discounts"
              body="Pick all four services — pay one invoice per property. Volume discounts apply automatically."
              mock={
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3 text-xs">
                  <p className="text-[var(--color-ink-muted)]">Invoice · April</p>
                  <p className="mt-1 font-mono text-[var(--color-ink)] tabular-nums">
                    € 4,245.00
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--color-epc)]">
                    − € 520 bundled savings
                  </p>
                </div>
              }
            />
            <FeatureCard
              title="Calendar sync with your team"
              body="Every assignment lands in the inspector's Google or Outlook calendar, automatically."
              mock={
                <div className="grid grid-cols-7 gap-1 text-[9px]">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded flex items-center justify-center"
                      style={{
                        backgroundColor:
                          i === 5 || i === 9
                            ? "color-mix(in srgb, var(--color-epc) 14%, white)"
                            : "var(--color-bg-alt)",
                        color: i === 5 || i === 9 ? "var(--color-epc)" : "var(--color-ink-muted)",
                      }}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              }
            />
            <FeatureCard
              title="Upload forms, signed by owner"
              body="Collect owner signatures on assignment forms — PDF and mobile-friendly."
              mock={
                <div className="rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] p-3 text-center text-xs text-[var(--color-ink-muted)]">
                  <p className="font-semibold text-[var(--color-ink)]">
                    assignment_form.pdf
                  </p>
                  <p className="mt-1">Signed · 2 hrs ago</p>
                </div>
              }
            />
            <FeatureCard
              title="Team & freelancer roles"
              body="Invite your office, add inspectors as freelancers, control who sees what."
              mock={
                <div className="space-y-1.5">
                  {[
                    { n: "Jordan Remy", r: "Admin", c: "#0f172a" },
                    { n: "Tim De Vos", r: "Freelancer", c: "#0d9488" },
                    { n: "Els Vermeulen", r: "Realtor", c: "#9f1239" },
                  ].map((u) => (
                    <div key={u.n} className="flex items-center gap-2">
                      <span
                        className="grid h-6 w-6 place-items-center rounded-full text-[9px] font-semibold text-white"
                        style={{ backgroundColor: u.c }}
                      >
                        {u.n.split(" ").map((p) => p[0]).join("")}
                      </span>
                      <span className="flex-1 text-xs text-[var(--color-ink)]">
                        {u.n}
                      </span>
                      <span className="text-[10px] text-[var(--color-ink-muted)]">
                        {u.r}
                      </span>
                    </div>
                  ))}
                </div>
              }
            />
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-brand)] text-white">
        <div className="mx-auto grid max-w-[1300px] gap-10 px-6 py-24 lg:grid-cols-[2fr_1fr] lg:items-center">
          <div>
            <p
              style={{
                fontSize: "clamp(1.5rem, 2.8vw, 2.25rem)",
                lineHeight: 1.3,
                letterSpacing: "-0.01em",
              }}
            >
              &ldquo;Our assistant used to spend her whole Monday chasing four inspectors
              for one sale. Now it&apos;s three clicks.&rdquo;
            </p>
            <div className="mt-8 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-semibold">
                EV
              </span>
              <div>
                <p className="text-sm font-medium">Els Vermeulen</p>
                <p className="text-xs text-white/60">Managing broker · Vastgoed Antwerp</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Metric n="−74%" l="Admin hours per sale" />
            <Metric n="4.2 d" l="Avg turnaround" />
            <Metric n="€ 520" l="Avg bundle saving" />
            <Metric n="0" l="Missed deadlines (YTD)" />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1100px] px-6 py-24 text-center">
          <h2
            className="font-semibold tracking-tight"
            style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.75rem)", lineHeight: 1.1 }}
          >
            Ship your next certificate from one dashboard.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-[var(--color-ink-soft)]">
            Free to set up. First assignment on us.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-6 text-sm font-semibold text-white transition-all hover:bg-[var(--color-brand-soft)] hover:shadow-lg"
            >
              Start free →
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-white px-6 text-sm font-semibold transition-colors hover:border-[var(--color-ink)]"
            >
              Book a walkthrough
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  title,
  body,
  mock,
}: {
  title: string;
  body: string;
  mock: React.ReactNode;
}) {
  return (
    <article className="group flex flex-col rounded-xl border border-[var(--color-border)] bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div className="min-h-[100px]">{mock}</div>
      <h3 className="mt-6 text-base font-semibold text-[var(--color-ink)]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">{body}</p>
    </article>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 12%, white)`,
        color: color,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function Metric({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{n}</p>
      <p className="mt-1 text-xs text-white/60">{l}</p>
    </div>
  );
}

function ProductShot() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_70%_30%,rgba(245,158,11,0.08),transparent_60%)]"
      />
      {/* Browser chrome */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-[0_32px_80px_-16px_rgba(15,23,42,0.25)]">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          <div className="ml-4 flex-1 rounded bg-white px-3 py-1 text-[10px] text-[var(--color-ink-muted)]">
            immo.app/dashboard
          </div>
        </div>

        <div className="flex">
          {/* Fake sidebar */}
          <div className="w-32 border-r border-[var(--color-border)] p-3 text-[10px]">
            <div className="mb-3 flex items-center gap-1.5 px-1">
              <span className="grid h-4 w-4 place-items-center rounded bg-[var(--color-brand)] text-[8px] font-bold text-white">
                I
              </span>
              <span className="font-semibold">Immo</span>
            </div>
            {[
              { l: "Overview", a: false },
              { l: "Assignments", a: true, b: "8" },
              { l: "Calendar", a: false },
              { l: "Teams", a: false },
              { l: "Users", a: false },
            ].map((i) => (
              <div
                key={i.l}
                className={
                  "relative flex items-center justify-between rounded px-2 py-1 " +
                  (i.a
                    ? "bg-[var(--color-bg-muted)] font-medium text-[var(--color-brand)]"
                    : "text-[var(--color-ink-muted)]")
                }
              >
                {i.a && (
                  <span className="absolute left-0 top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-r bg-[var(--color-brand)]" />
                )}
                <span>{i.l}</span>
                {i.b && (
                  <span className="rounded bg-[var(--color-accent)] px-1 text-[8px] font-semibold text-[var(--color-brand)]">
                    {i.b}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Fake content */}
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Assignments</p>
              <span className="rounded bg-[var(--color-brand)] px-2 py-0.5 text-[9px] font-semibold text-white">
                + New
              </span>
            </div>

            <div className="mt-3 space-y-1.5">
              {[
                { ref: "ASG-1001", addr: "Meir 34, Antwerpen", s: ["EPC", "AIV"], st: "Scheduled", sc: "#1d4ed8" },
                { ref: "ASG-1002", addr: "Place St-Gudule 12", s: ["AIV", "EK", "TK"], st: "In progress", sc: "#b45309" },
                { ref: "ASG-1003", addr: "Sint-Pietersnieuwstraat 45", s: ["EPC"], st: "Delivered", sc: "#15803d" },
                { ref: "ASG-1004", addr: "Grote Markt 7, Mechelen", s: ["EPC", "AIV", "EK"], st: "Completed", sc: "#365314" },
              ].map((r) => (
                <div
                  key={r.ref}
                  className="flex items-center justify-between rounded border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[10px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[var(--color-ink-muted)]">
                      {r.ref}
                    </span>
                    <span className="text-[var(--color-ink)]">{r.addr}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                      {r.s.map((x) => {
                        const c =
                          x === "EPC" ? "var(--color-epc)" :
                          x === "AIV" ? "var(--color-asbestos)" :
                          x === "EK" ? "var(--color-electrical)" :
                          "var(--color-fuel)";
                        return (
                          <span
                            key={x}
                            className="rounded px-1 text-[8px] font-bold"
                            style={{
                              color: c,
                              backgroundColor: `color-mix(in srgb, ${c} 14%, white)`,
                              border: `1px solid color-mix(in srgb, ${c} 30%, white)`,
                            }}
                          >
                            {x}
                          </span>
                        );
                      })}
                    </div>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[8px] font-medium"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${r.sc} 14%, white)`,
                        color: r.sc,
                      }}
                    >
                      {r.st}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating notification */}
      <div className="absolute -bottom-5 -left-5 rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-epc)_14%,white)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-epc)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-medium">EPC delivered</p>
            <p className="text-[10px] text-[var(--color-ink-muted)]">
              Tim · just now
            </p>
          </div>
        </div>
      </div>

      {/* Floating stat */}
      <div className="absolute -right-4 -top-4 rounded-lg bg-[var(--color-brand)] p-3 text-white shadow-[var(--shadow-md)]">
        <p className="text-[10px] uppercase tracking-wider text-white/60">This week</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums">+23</p>
        <p className="text-[10px] text-white/60">delivered</p>
      </div>
    </div>
  );
}
