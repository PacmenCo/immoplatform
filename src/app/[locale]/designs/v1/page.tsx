import { Link } from "@/i18n/navigation";

const services = [
  { n: "01", code: "EPC", label: "Energy Performance Certificate", body: "Legally required energy rating for every sale or rental in Belgium." },
  { n: "02", code: "AIV", label: "Asbestos Inventory Attest", body: "Mandatory inventory for any building from before 2001." },
  { n: "03", code: "EK", label: "Electrical Inspection", body: "AREI installation inspection, required at sale and after major works." },
  { n: "04", code: "TK", label: "Fuel Tank Check", body: "Periodic inspection for above-ground and buried heating-oil tanks." },
];

export default function EditorialVariant() {
  return (
    <main style={{ backgroundColor: "#f6f1ea" }} className="text-[#1a1a1a]">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-[1100px] px-6 pt-28 pb-24 md:pt-40 md:pb-32">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#7a6f5f]">
            <span className="h-px w-10 bg-[#7a6f5f]" />
            <span>Belgium · Est. 2026</span>
          </div>

          <h1
            className="mt-10 max-w-[18ch]"
            style={{
              fontFamily: "var(--font-sans), ui-serif, Georgia, serif",
              fontSize: "clamp(3rem, 8vw, 6.5rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              fontWeight: 400,
            }}
          >
            Every certificate.{" "}
            <em
              style={{
                fontStyle: "italic",
                fontVariationSettings: '"opsz" 144',
                color: "#8a6c3f",
              }}
            >
              One roof.
            </em>
          </h1>

          <p
            className="mt-10 max-w-xl text-lg leading-relaxed text-[#3d3529]"
            style={{ fontFamily: "var(--font-sans), ui-serif, Georgia, serif" }}
          >
            We are four certification practices — newly joined — serving Belgian real-estate
            agencies with Energy Performance Certificates, Asbestos Inventory Attests,
            Electrical Inspections and Fuel Tank Checks, delivered from a single desk.
          </p>

          <div className="mt-14 flex flex-wrap items-center gap-8">
            <Link
              href="/register"
              className="inline-flex items-center gap-3 border-b border-[#1a1a1a] pb-1 text-sm font-medium tracking-wide text-[#1a1a1a] transition-opacity hover:opacity-70"
            >
              Open an account
              <span className="text-base">→</span>
            </Link>
            <Link
              href="/demo"
              className="text-sm tracking-wide text-[#7a6f5f] underline decoration-dotted underline-offset-4 transition-colors hover:text-[#1a1a1a]"
            >
              Or speak with someone first
            </Link>
          </div>
        </div>

        {/* Decorative typographic mark */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-10 -right-6 select-none opacity-[0.07]"
          style={{
            fontFamily: "var(--font-sans), serif",
            fontSize: "clamp(10rem, 30vw, 22rem)",
            lineHeight: 1,
            fontStyle: "italic",
            letterSpacing: "-0.05em",
          }}
        >
          Immo
        </div>
      </section>

      {/* Separator */}
      <div className="mx-auto max-w-[1100px] px-6">
        <hr className="border-[#d4c5ab]" />
      </div>

      {/* Services */}
      <section className="mx-auto max-w-[1100px] px-6 py-28">
        <div className="grid gap-16 md:grid-cols-[1fr_2fr] md:gap-24">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#7a6f5f]">What we do</p>
            <h2
              className="mt-6"
              style={{
                fontFamily: "var(--font-sans), ui-serif, Georgia, serif",
                fontSize: "clamp(2rem, 3.5vw, 2.75rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                fontWeight: 400,
              }}
            >
              Four certifications, every property needs.
            </h2>
          </div>

          <ol className="space-y-10">
            {services.map((s) => (
              <li key={s.code} className="grid grid-cols-[auto_1fr] gap-6 border-t border-[#d4c5ab] pt-10 first:border-0 first:pt-0">
                <span
                  className="text-[#8a6c3f]"
                  style={{
                    fontFamily: "var(--font-sans), serif",
                    fontSize: "1.5rem",
                    fontStyle: "italic",
                  }}
                >
                  {s.n}
                </span>
                <div>
                  <div className="flex items-baseline gap-3">
                    <h3
                      className="text-xl text-[#1a1a1a]"
                      style={{
                        fontFamily: "var(--font-sans), serif",
                        fontWeight: 500,
                      }}
                    >
                      {s.label}
                    </h3>
                    <span className="text-xs uppercase tracking-wider text-[#7a6f5f]">
                      {s.code}
                    </span>
                  </div>
                  <p className="mt-3 max-w-lg leading-relaxed text-[#3d3529]">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Quote */}
      <section className="border-y border-[#d4c5ab]" style={{ backgroundColor: "#ece3d4" }}>
        <div className="mx-auto max-w-[900px] px-6 py-28 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mx-auto text-[#8a6c3f]" aria-hidden>
            <path d="M9 7H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v2a2 2 0 0 1-2 2H4M21 7h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v2a2 2 0 0 1-2 2h-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p
            className="mt-10 text-[#1a1a1a]"
            style={{
              fontFamily: "var(--font-sans), serif",
              fontSize: "clamp(1.5rem, 2.8vw, 2.25rem)",
              lineHeight: 1.25,
              letterSpacing: "-0.015em",
              fontWeight: 400,
            }}
          >
            <em style={{ fontStyle: "italic" }}>
              Four inspectors, four invoices, four inboxes.
            </em>{" "}
            Now one.
          </p>
          <p className="mt-10 text-sm uppercase tracking-[0.2em] text-[#7a6f5f]">
            Els Vermeulen · Vastgoed Antwerp
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-[1100px] px-6 py-28">
        <div className="grid gap-10 md:grid-cols-4">
          {[
            { n: "12,000+", l: "Certificates issued" },
            { n: "400+", l: "Agencies on board" },
            { n: "< 5d", l: "Average turnaround" },
            { n: "3", l: "Regions covered" },
          ].map((s) => (
            <div key={s.l}>
              <p
                className="text-[#8a6c3f]"
                style={{
                  fontFamily: "var(--font-sans), serif",
                  fontSize: "clamp(2.5rem, 4vw, 3.5rem)",
                  lineHeight: 1,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                }}
              >
                {s.n}
              </p>
              <p className="mt-4 text-sm uppercase tracking-[0.15em] text-[#3d3529]">
                {s.l}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#d4c5ab]">
        <div className="mx-auto max-w-[1100px] px-6 py-28 text-center">
          <h2
            style={{
              fontFamily: "var(--font-sans), serif",
              fontSize: "clamp(2.25rem, 4vw, 3.25rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontWeight: 400,
            }}
          >
            Set up your agency.
            <br />
            <em style={{ fontStyle: "italic", color: "#8a6c3f" }}>
              First assignment on us.
            </em>
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-8">
            <Link
              href="/register"
              className="inline-flex items-center gap-3 border-b border-[#1a1a1a] pb-1 text-sm font-medium tracking-wide text-[#1a1a1a] transition-opacity hover:opacity-70"
            >
              Open an account
              <span className="text-base">→</span>
            </Link>
            <Link
              href="/demo"
              className="text-sm tracking-wide text-[#7a6f5f] underline decoration-dotted underline-offset-4 transition-colors hover:text-[#1a1a1a]"
            >
              Book a walkthrough
            </Link>
          </div>
          <p className="mt-16 text-xs uppercase tracking-[0.2em] text-[#7a6f5f]">
            Immo — Brussels, Antwerp, Gent, Liège
          </p>
        </div>
      </section>
    </main>
  );
}
