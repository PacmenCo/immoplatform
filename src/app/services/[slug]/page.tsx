import { notFound } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { IconCheck, IconArrowRight } from "@/components/ui/Icons";
import { SERVICES, ServiceKey } from "@/lib/mockData";

const detail: Record<
  ServiceKey,
  {
    hero: string;
    body: string;
    bullets: string[];
    turnaround: string;
    regulation: string;
    who: string;
  }
> = {
  epc: {
    hero: "Energy Performance Certificates, issued fast.",
    body:
      "The Energy Performance Certificate (EPC) is mandatory for every residential sale or lease in Belgium. Our certified inspectors deliver the documentation within days — your agents never block a signing again.",
    bullets: [
      "Certified EPC inspectors in Flanders, Brussels & Wallonia",
      "Digital delivery (PDF + VEKA submission) within 3 working days",
      "Bundling discount when ordered with other services",
      "Re-inspection support after renovation",
    ],
    turnaround: "3 working days",
    regulation: "Mandatory per Flemish Energy Agency (VEKA) regulations",
    who: "Every home sold or leased in Belgium",
  },
  asbestos: {
    hero: "Asbestos Inventory Attests, no surprises.",
    body:
      "The Asbestos Inventory Attest (AIV) is legally required for every building constructed before 2001 at the point of sale. Our certified asbestos experts inspect, sample and certify with turnaround times most agencies dream of.",
    bullets: [
      "Certified OVAM inspectors",
      "Non-destructive sampling where possible",
      "Legally valid attestation, signed within 5 working days",
      "Connected to your assignment — no double data entry",
    ],
    turnaround: "5 working days",
    regulation: "Mandatory per Flemish OVAM regulations for pre-2001 buildings",
    who: "Any seller of a pre-2001 residential or commercial building",
  },
  electrical: {
    hero: "AREI-compliant Electrical Inspections.",
    body:
      "The Electrical Inspection (EK) ensures the property meets the Belgian AREI safety code. Required on sale and after major renovation work — and the first thing a buyer's lawyer will ask about.",
    bullets: [
      "AGORIA-certified electrical inspectors",
      "Compliant inspection report per AREI standards",
      "Follow-up re-inspection after remediation",
      "Integrated into the same dashboard as your other certificates",
    ],
    turnaround: "4 working days",
    regulation: "AREI (Belgian General Electrical Regulation) compliance",
    who: "Any property sold or with recent electrical work",
  },
  fuel: {
    hero: "Fuel Tank Checks, done right.",
    body:
      "Fuel Tank Checks (TK) are required periodically for above-ground and buried heating-oil tanks in Flanders. We schedule, inspect, issue the attest and alert you before the next one is due — so a routine check never delays a sale.",
    bullets: [
      "Certified fuel-tank inspectors",
      "Buried and above-ground tank specialties",
      "Automatic reminders before re-inspection deadlines",
      "Environmental compliance built-in",
    ],
    turnaround: "5 working days",
    regulation: "VLAREM II periodic inspection requirements",
    who: "Homeowners and agents with heating-oil tanks on property",
  },
};

export function generateStaticParams() {
  return (Object.keys(SERVICES) as ServiceKey[]).map((slug) => ({ slug }));
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(slug in SERVICES)) notFound();
  const key = slug as ServiceKey;
  const svc = SERVICES[key];
  const d = detail[key];

  return (
    <>
      <Nav />
      <main className="flex-1">
        <section
          className="border-b border-[var(--color-border)]"
          style={{ backgroundColor: `color-mix(in srgb, ${svc.color} 6%, white)` }}
        >
          <div className="mx-auto max-w-[var(--container)] px-6 py-20">
            <Link href="/#services" className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
              ← All services
            </Link>
            <div className="mt-6 flex items-center gap-3">
              <span
                className="inline-flex h-7 px-2.5 items-center justify-center rounded text-xs font-bold tracking-wider text-white"
                style={{ backgroundColor: svc.color }}
              >
                {svc.short}
              </span>
              <span className="text-sm font-medium text-[var(--color-ink-muted)]">
                {svc.label}
              </span>
            </div>
            <h1
              className="mt-4 font-semibold tracking-tight text-[var(--color-ink)]"
              style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)", lineHeight: 1.1 }}
            >
              {d.hero}
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-[var(--color-ink-soft)]">{d.body}</p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button href="/register" size="lg">
                Order {svc.short}
                <IconArrowRight size={16} />
              </Button>
              <Button href="#how" variant="secondary" size="lg">
                How it works
              </Button>
            </div>
          </div>
        </section>

        <section id="how" className="border-b border-[var(--color-border)]">
          <div className="mx-auto max-w-[var(--container)] px-6 py-20">
            <div className="grid gap-16 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                  What you get
                </p>
                <h2
                  className="mt-3 font-semibold tracking-tight"
                  style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)" }}
                >
                  Everything handled, nothing forgotten.
                </h2>
                <ul className="mt-8 space-y-4">
                  {d.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full"
                        style={{ backgroundColor: `color-mix(in srgb, ${svc.color} 15%, white)`, color: svc.color }}
                      >
                        <IconCheck size={14} />
                      </span>
                      <span className="text-[var(--color-ink-soft)]">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-8 space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Turnaround
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                    {d.turnaround}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Regulation
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{d.regulation}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Who it&apos;s for
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{d.who}</p>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-white p-5">
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    Bundle & save
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                    Order this together with other certificates for a bundled discount on every assignment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
