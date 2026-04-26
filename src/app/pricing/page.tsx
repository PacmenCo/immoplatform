import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ServicePill } from "@/components/ui/Badge";
import { IconCheck } from "@/components/ui/Icons";
import { SERVICES } from "@/lib/mockData";

const tiers = [
  {
    name: "Starter",
    price: "€ 0",
    period: "/mo",
    description: "For independent agents testing the waters.",
    cta: "Start for free",
    ctaHref: "/register",
    variant: "secondary" as const,
    features: [
      "Up to 5 assignments / month",
      "1 seat",
      "Pay-per-service pricing",
      "Email support",
      "Standard turnaround (5 days)",
    ],
  },
  {
    name: "Pro",
    price: "€ 99",
    period: "/mo",
    description: "For growing agencies with recurring volume.",
    cta: "Start 14-day trial",
    ctaHref: "/register",
    variant: "primary" as const,
    featured: true,
    features: [
      "Unlimited assignments",
      "Up to 5 seats",
      "10% volume discount on every service",
      "Priority support",
      "Priority turnaround (3 days)",
      "Shared team workspace",
      "Branded client documents",
    ],
  },
  {
    name: "Agency",
    price: "€ 299",
    period: "/mo",
    description: "For multi-office networks and franchise groups.",
    cta: "Contact sales",
    ctaHref: "/contact",
    variant: "secondary" as const,
    features: [
      "Everything in Pro",
      "Unlimited seats",
      "20% volume discount",
      "Dedicated account manager",
      "Same-day turnaround",
      "Custom branding & API access",
      "Multi-office reporting",
      "SLA & DPA agreements",
    ],
  },
];

const perService = [
  { key: "epc" as const, price: "€ 185", unit: "per dwelling" },
  { key: "asbestos" as const, price: "€ 395", unit: "per building" },
  { key: "electrical" as const, price: "€ 145", unit: "per installation" },
  { key: "fuel" as const, price: "€ 120", unit: "per tank" },
];

const comparisonRows = [
  { label: "Assignments per month", starter: "5", pro: "Unlimited", agency: "Unlimited" },
  { label: "Team seats", starter: "1", pro: "5", agency: "Unlimited" },
  { label: "Volume discount", starter: "—", pro: "10%", agency: "20%" },
  { label: "Turnaround SLA", starter: "5 days", pro: "3 days", agency: "Same day" },
  { label: "Client portal", starter: "Basic", pro: "Branded", agency: "White-label" },
  { label: "API access", starter: "—", pro: "Read-only", agency: "Full" },
  { label: "Account manager", starter: "—", pro: "—", agency: "Dedicated" },
  { label: "Multi-office reporting", starter: "—", pro: "—", agency: "Yes" },
];

const faqs = [
  {
    q: "Do I pay per service or per month?",
    a: "Both. The monthly plan covers platform access, seats and volume discounts. Individual services (EPC, AIV, EK, TK) are billed per assignment at the rates shown above, with your plan's discount applied automatically.",
  },
  {
    q: "What happens if I exceed my Starter quota?",
    a: "Assignments above the Starter quota are billed at the standard per-service rate with no discount. You can upgrade to Pro at any time and the discount applies from that assignment onward.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. Upgrades take effect immediately and are prorated. Downgrades take effect at the end of the current billing period.",
  },
  {
    q: "Is there a long-term contract?",
    a: "No. Pro and Agency are month-to-month. Annual billing is available on request at a 15% discount.",
  },
  {
    q: "Do you handle VAT?",
    a: "Yes. Belgian VAT is shown separately on every invoice. EU B2B customers with a valid VAT number are reverse-charged.",
  },
  {
    q: "Which regions do you cover?",
    a: "All three Belgian regions: Flanders, Brussels-Capital and Wallonia. Our inspectors operate province-wide with guaranteed next-week scheduling.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          <div className="mx-auto max-w-[var(--container)] px-6 py-20 text-center md:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs font-medium text-[var(--color-ink-soft)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-epc)]" />
              Simple, transparent pricing
            </span>
            <h1
              className="mx-auto mt-6 max-w-3xl font-semibold tracking-tight text-[var(--color-ink)]"
              style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.05 }}
            >
              Pay for what you certify. Nothing you don&apos;t.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[var(--color-ink-soft)]" style={{ fontSize: "clamp(1rem, 1.4vw, 1.15rem)" }}>
              Plans scale with your volume. Every tier includes all four services, priority scheduling and VAT-ready invoicing.
            </p>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-[var(--container)] px-6">
            <div className="grid gap-6 md:grid-cols-3">
              {tiers.map((tier) => (
                <Card
                  key={tier.name}
                  className={
                    tier.featured
                      ? "relative border-[var(--color-ink)] shadow-[var(--shadow-lg)]"
                      : "relative"
                  }
                >
                  {tier.featured && (
                    <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs font-semibold text-white">
                      Most popular
                    </span>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{tier.name}</CardTitle>
                    <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{tier.description}</p>
                    <div className="mt-6 flex items-baseline gap-1">
                      <span className="text-4xl font-semibold tracking-tight text-[var(--color-ink)]">
                        {tier.price}
                      </span>
                      <span className="text-sm text-[var(--color-ink-muted)]">{tier.period}</span>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <Button href={tier.ctaHref} variant={tier.variant} size="lg" className="w-full">
                      {tier.cta}
                    </Button>
                    <ul className="mt-6 space-y-3">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-start gap-3 text-sm text-[var(--color-ink-soft)]">
                          <span className="mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full bg-[var(--color-epc)]/15 text-[var(--color-epc)]">
                            <IconCheck size={12} />
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-alt)] py-20">
          <div className="mx-auto max-w-[var(--container)] px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Per-service pricing</h2>
              <p className="mt-3 text-[var(--color-ink-soft)]">
                Base rates before plan discount. All rates are shown ex-VAT and include report, lab fees and digital delivery.
              </p>
            </div>

            <div className="mt-10 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-[var(--color-bg-muted)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">Service</th>
                    <th className="px-6 py-3 text-left font-medium">Typical scope</th>
                    <th className="px-6 py-3 text-left font-medium">Base rate</th>
                    <th className="px-6 py-3 text-left font-medium">Pro (-10%)</th>
                    <th className="px-6 py-3 text-left font-medium">Agency (-20%)</th>
                  </tr>
                </thead>
                <tbody>
                  {perService.map((s, i) => {
                    const svc = SERVICES[s.key];
                    const base = parseInt(s.price.replace(/[^\d]/g, ""), 10);
                    return (
                      <tr key={s.key} className={i % 2 === 0 ? "bg-[var(--color-bg)]" : "bg-[var(--color-bg-alt)]"}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <ServicePill color={svc.color} label={svc.short} />
                            <span className="font-medium text-[var(--color-ink)]">{svc.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[var(--color-ink-muted)]">{s.unit}</td>
                        <td className="px-6 py-4 font-medium text-[var(--color-ink)]">{s.price}</td>
                        <td className="px-6 py-4 text-[var(--color-ink-soft)]">€ {Math.round(base * 0.9)}</td>
                        <td className="px-6 py-4 text-[var(--color-ink-soft)]">€ {Math.round(base * 0.8)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-[var(--container)] px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Compare plans</h2>
              <p className="mt-3 text-[var(--color-ink-soft)]">
                Every feature across every tier, in one table.
              </p>
            </div>

            <div className="mt-10 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-[var(--color-bg-muted)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">Feature</th>
                    <th className="px-6 py-3 text-left font-medium">Starter</th>
                    <th className="px-6 py-3 text-left font-medium">Pro</th>
                    <th className="px-6 py-3 text-left font-medium">Agency</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr
                      key={row.label}
                      className={
                        i % 2 === 0
                          ? "border-t border-[var(--color-border)] bg-[var(--color-bg)]"
                          : "border-t border-[var(--color-border)] bg-[var(--color-bg-alt)]"
                      }
                    >
                      <td className="px-6 py-4 font-medium text-[var(--color-ink)]">{row.label}</td>
                      <td className="px-6 py-4 text-[var(--color-ink-soft)]">{row.starter}</td>
                      <td className="px-6 py-4 text-[var(--color-ink-soft)]">{row.pro}</td>
                      <td className="px-6 py-4 text-[var(--color-ink-soft)]">{row.agency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-alt)] py-20">
          <div className="mx-auto max-w-[var(--container)] px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Frequently asked</h2>
              <p className="mt-3 text-[var(--color-ink-soft)]">Still wondering? The answers are probably here.</p>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-2">
              {faqs.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 open:shadow-[var(--shadow-sm)]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-[var(--color-ink)]">
                    {f.q}
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-ink-muted)] transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 text-sm text-[var(--color-ink-soft)]">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-[var(--container)] px-6">
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-10 text-center md:p-16">
              <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-[var(--color-ink)] md:text-4xl">
                Ready to certify at scale?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[var(--color-ink-soft)]">
                Start free today. Upgrade the day you feel the ceiling.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button href="/register" size="lg" variant="primary">
                  Create account
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
