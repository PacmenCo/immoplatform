import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { ServicePill } from "@/components/ui/Badge";
import { SERVICES } from "@/lib/mockData";

const timeline = [
  {
    year: "2011",
    title: "Asbest Experts founded",
    body: "The oldest of the four — started as a two-person asbestos inventory practice in Antwerp and grew into a region-wide operation.",
    tag: "asbestos" as const,
  },
  {
    year: "2015",
    title: "EPC Partner joins",
    body: "A dedicated EPC specialist with certified assessors across Flanders and Brussels merges to offer energy certificates under the same roof.",
    tag: "epc" as const,
  },
  {
    year: "2018",
    title: "Elec Inspect comes aboard",
    body: "AREI-accredited electrical inspectors bring installation checks into the portfolio, making pre-sale compliance a one-stop service.",
    tag: "electrical" as const,
  },
  {
    year: "2021",
    title: "Tank Check completes the team",
    body: "The last specialist — certified fuel-tank inspectors — joins, covering above-ground and buried tanks for residential and commercial clients.",
    tag: "fuel" as const,
  },
  {
    year: "2026",
    title: "Immo launches",
    body: "Four specialists, one brand, one platform. We open our shared dashboard to every real-estate agency in Belgium.",
    tag: null,
  },
];

const values = [
  {
    title: "One file, one truth",
    body: "Every certificate, report and invoice lives in the same folder. No email threads, no spreadsheets.",
  },
  {
    title: "Specialists only",
    body: "Every service is delivered by a certified, accredited inspector — never a generalist.",
  },
  {
    title: "Transparent by default",
    body: "Flat rates, no hidden fees, and real-time status visible to every party on the assignment.",
  },
  {
    title: "Belgium first",
    body: "Built for the regional quirks — Flemish EPC, Brussels electrical, Walloon asbestos. Local rules, national coverage.",
  },
  {
    title: "Inspector-friendly",
    body: "Our freelancers get fair rates, clean scheduling and tools that actually help in the field.",
  },
  {
    title: "Keep the receipts",
    body: "Every document is retained for 10 years, indexed and exportable in one click.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          <div className="mx-auto max-w-[var(--container)] px-6 py-24 md:py-32">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs font-medium text-[var(--color-ink-soft)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                About Immo
              </span>
              <h1
                className="mt-6 font-semibold tracking-tight text-[var(--color-ink)]"
                style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1.05 }}
              >
                Four specialists, one team.
              </h1>
              <p
                className="mt-6 max-w-2xl text-[var(--color-ink-soft)]"
                style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.25rem)" }}
              >
                We brought together the four Belgian certification practices our customers were already using — and
                rebuilt the paperwork around one dashboard. No more juggling three invoices and four inspectors for
                a single property sale.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-[var(--container)] px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">How we got here</h2>
              <p className="mt-3 text-[var(--color-ink-soft)]">
                Fifteen years of independent craft, three acquisitions, and one shared platform.
              </p>
            </div>

            <ol className="relative mt-12 space-y-10 border-l border-[var(--color-border)] pl-8">
              {timeline.map((item) => {
                const svc = item.tag ? SERVICES[item.tag] : null;
                return (
                  <li key={item.year} className="relative">
                    <span
                      className="absolute -left-[2.1rem] top-1.5 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-[var(--color-ink)]"
                      style={svc ? { background: svc.color } : undefined}
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                        {item.year}
                      </span>
                      {svc && <ServicePill color={svc.color} label={svc.short} />}
                    </div>
                    <h3 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">{item.title}</h3>
                    <p className="mt-2 max-w-2xl text-[var(--color-ink-soft)]">{item.body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-alt)] py-20">
          <div className="mx-auto max-w-[var(--container)] px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">What we believe</h2>
              <p className="mt-3 text-[var(--color-ink-soft)]">
                Six principles that shape the way we build, inspect and invoice.
              </p>
            </div>

            <div className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-3">
              {values.map((v) => (
                <div key={v.title} className="bg-[var(--color-bg)] p-8">
                  <h3 className="text-base font-semibold text-[var(--color-ink)]">{v.title}</h3>
                  <p className="mt-3 text-sm text-[var(--color-ink-soft)]">{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-alt)] py-20">
          <div className="mx-auto max-w-[var(--container)] px-6 text-center">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-[var(--color-ink)] md:text-4xl">
              Four certificates, one workflow.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--color-ink-soft)]">
              Register your agency and start routing every EPC, asbestos, electrical and fuel-tank check from a single dashboard.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button href="/register" size="lg">
                Register your agency
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
