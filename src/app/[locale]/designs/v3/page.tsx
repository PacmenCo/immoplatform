import { Link } from "@/i18n/navigation";

const services = [
  {
    code: "EPC",
    label: "Energy Performance Certificate",
    color: "#10b981",
    bg: "#ecfdf5",
    ink: "#064e3b",
    n: "01",
    body: "Mandatory energy rating for every residential sale or lease in Belgium. Delivered within 3 working days.",
    meta: ["VEKA submission included", "3 working days", "From € 165"],
  },
  {
    code: "AIV",
    label: "Asbestos Inventory Attest",
    color: "#e11d48",
    bg: "#fff1f2",
    ink: "#4c0519",
    n: "02",
    body: "Legally required asbestos inventory for any building constructed before 2001 at the point of sale.",
    meta: ["OVAM-certified inspectors", "5 working days", "From € 245"],
  },
  {
    code: "EK",
    label: "Electrical Inspection",
    color: "#f59e0b",
    bg: "#fffbeb",
    ink: "#451a03",
    n: "03",
    body: "AREI installation inspection for safe electrical systems. Required on sale and after major renovation work.",
    meta: ["AREI compliance report", "4 working days", "From € 195"],
  },
  {
    code: "TK",
    label: "Fuel Tank Check",
    color: "#0ea5e9",
    bg: "#f0f9ff",
    ink: "#082f49",
    n: "04",
    body: "Periodic inspection for above-ground and buried heating-oil tanks under VLAREM II regulations.",
    meta: ["Buried & above-ground", "5 working days", "From € 135"],
  },
];

export default function BrandForwardVariant() {
  return (
    <main className="bg-white text-[var(--color-ink)]">
      {/* Hero — split with colored blocks */}
      <section className="relative grid lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-center px-6 py-20 lg:px-16 lg:py-32">
          <div className="flex items-center gap-2">
            {services.map((s) => (
              <span
                key={s.code}
                className="h-1.5 w-10 rounded-full"
                style={{ backgroundColor: s.color }}
              />
            ))}
          </div>

          <h1
            className="mt-10 font-bold tracking-tight"
            style={{ fontSize: "clamp(2.75rem, 6vw, 5rem)", lineHeight: 0.98, letterSpacing: "-0.035em" }}
          >
            Four certificates.
            <br />
            <span className="inline-flex flex-wrap gap-x-3">
              <span style={{ color: "#10b981" }}>One</span>
              <span style={{ color: "#e11d48" }}>single</span>
              <span style={{ color: "#f59e0b" }}>bloody</span>
              <span style={{ color: "#0ea5e9" }}>platform.</span>
            </span>
          </h1>

          <p className="mt-8 max-w-md text-lg text-[var(--color-ink-soft)]">
            EPC, AIV, EK, TK. Every certification a Belgian property needs — ordered,
            tracked and delivered from one dashboard.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--color-brand)] px-7 text-sm font-semibold text-white transition-all hover:shadow-xl"
            >
              Start for free
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-[var(--color-brand)] px-7 text-sm font-semibold transition-colors hover:bg-[var(--color-brand)] hover:text-white"
            >
              Book a demo
            </Link>
          </div>
        </div>

        {/* Colored 2x2 grid of service tiles */}
        <div className="grid grid-cols-2 lg:min-h-[720px]">
          {services.map((s) => (
            <div
              key={s.code}
              className="relative flex flex-col justify-between overflow-hidden p-8 transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: s.bg, color: s.ink }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-mono uppercase tracking-wider"
                  style={{ color: s.color }}
                >
                  {s.n}
                </span>
                <span
                  className="grid h-10 w-10 place-items-center rounded-full text-[11px] font-bold tracking-wider text-white"
                  style={{ backgroundColor: s.color }}
                >
                  {s.code}
                </span>
              </div>
              <div>
                <p
                  className="font-bold tracking-tight"
                  style={{ fontSize: "clamp(1.25rem, 2.2vw, 1.75rem)", lineHeight: 1.05, color: s.ink }}
                >
                  {s.label}
                </p>
              </div>
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-8 -right-4 select-none text-[10rem] font-black leading-none opacity-[0.08]"
                style={{ color: s.color }}
              >
                {s.code}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Service deep-dives — alternating full-width colored blocks */}
      {services.map((s, i) => (
        <section
          key={s.code}
          className="border-t"
          style={{
            backgroundColor: s.bg,
            borderColor: `color-mix(in srgb, ${s.color} 20%, white)`,
            color: s.ink,
          }}
        >
          <div
            className={
              "mx-auto grid max-w-[1300px] gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center " +
              (i % 2 === 1 ? "lg:[&>:first-child]:order-2" : "")
            }
          >
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-10 items-center rounded-full px-4 text-xs font-bold tracking-wider text-white"
                  style={{ backgroundColor: s.color }}
                >
                  {s.code}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: s.color }}>
                  Service {s.n}
                </span>
              </div>
              <h2
                className="mt-6 font-bold tracking-tight"
                style={{ fontSize: "clamp(2rem, 3.8vw, 2.75rem)", lineHeight: 1.02, letterSpacing: "-0.025em" }}
              >
                {s.label}
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-relaxed" style={{ opacity: 0.8 }}>
                {s.body}
              </p>
              <dl className="mt-10 grid grid-cols-3 gap-4 border-t pt-6" style={{ borderColor: `color-mix(in srgb, ${s.color} 25%, white)` }}>
                {s.meta.map((m, idx) => (
                  <div key={m}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: s.color }}>
                      {["Scope", "Turnaround", "Pricing"][idx]}
                    </dt>
                    <dd className="mt-1.5 text-sm font-medium">{m}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-10">
                <Link
                  href={`/services/${s.code.toLowerCase() === "aiv" ? "asbestos" : s.code.toLowerCase() === "ek" ? "electrical" : s.code.toLowerCase() === "tk" ? "fuel" : "epc"}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4 hover:no-underline"
                  style={{ color: s.color }}
                >
                  Read more about {s.code} →
                </Link>
              </div>
            </div>

            {/* Giant code card */}
            <div
              className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[2rem] shadow-2xl"
              style={{
                backgroundColor: s.color,
                backgroundImage: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 50%)`,
              }}
            >
              <span
                className="font-black text-white"
                style={{
                  fontSize: "clamp(6rem, 18vw, 14rem)",
                  lineHeight: 0.8,
                  letterSpacing: "-0.05em",
                }}
              >
                {s.code}
              </span>
              <span className="absolute bottom-6 right-6 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                {s.n} / 04
              </span>
              <span className="absolute top-6 left-6 h-2 w-2 rounded-full bg-white" />
            </div>
          </div>
        </section>
      ))}

      {/* Stats bar — dark */}
      <section className="bg-[var(--color-brand)] text-white">
        <div className="mx-auto grid max-w-[1300px] gap-y-10 gap-x-6 px-6 py-20 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "12k+", l: "Certificates issued", c: "#10b981" },
            { n: "400+", l: "Belgian agencies", c: "#e11d48" },
            { n: "< 5 d", l: "Average turnaround", c: "#f59e0b" },
            { n: "1", l: "Invoice per property", c: "#0ea5e9" },
          ].map((s) => (
            <div key={s.l} className="border-l-2 pl-5" style={{ borderColor: s.c }}>
              <p
                className="font-bold tracking-tight tabular-nums"
                style={{ fontSize: "clamp(2.5rem, 4vw, 3.5rem)", lineHeight: 1, color: s.c }}
              >
                {s.n}
              </p>
              <p className="mt-3 text-sm text-white/70">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto max-w-[1100px] px-6 py-28 text-center">
          <div className="mb-10 flex items-center justify-center gap-2">
            {services.map((s) => (
              <span
                key={s.code}
                className="grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold tracking-wider text-white"
                style={{ backgroundColor: s.color }}
              >
                {s.code}
              </span>
            ))}
          </div>
          <h2
            className="font-bold tracking-tight"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.5rem)", lineHeight: 1.02, letterSpacing: "-0.03em" }}
          >
            Every property needs all four.
            <br />
            <span className="text-[var(--color-ink-muted)]">Now so do you.</span>
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--color-brand)] px-7 text-sm font-semibold text-white transition-all hover:shadow-xl"
            >
              Register your office →
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-[var(--color-brand)] px-7 text-sm font-semibold transition-colors hover:bg-[var(--color-brand)] hover:text-white"
            >
              Book a demo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
