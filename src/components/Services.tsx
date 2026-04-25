import Link from "next/link";

type Service = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  colorVar: string;
  badge: string;
  icon: React.ReactNode;
};

const services: Service[] = [
  {
    slug: "epc",
    title: "Energy Performance Certificate",
    tagline: "EPC",
    description:
      "Mandatory energy-performance rating for every residential sale or lease, delivered within days.",
    colorVar: "var(--color-epc)",
    badge: "EPC",
    icon: <IconLeaf />,
  },
  {
    slug: "asbestos",
    title: "Asbestos Inventory Attest",
    tagline: "AIV",
    description:
      "Legally required asbestos inventory for buildings built before 2001. Certified inspectors, fast turnaround.",
    colorVar: "var(--color-asbestos)",
    badge: "AIV",
    icon: <IconShield />,
  },
  {
    slug: "electrical",
    title: "Electrical Inspection",
    tagline: "EK",
    description:
      "AREI installation inspection for safe electrical systems. Required on sale and after major renovations.",
    colorVar: "var(--color-electrical)",
    badge: "EK",
    icon: <IconBolt />,
  },
  {
    slug: "fuel",
    title: "Fuel Tank Check",
    tagline: "TK",
    description:
      "Above-ground and buried heating-oil tank inspections, certified for Flemish regulations.",
    colorVar: "var(--color-fuel)",
    badge: "TK",
    icon: <IconDroplet />,
  },
];

export default function Services() {
  return (
    <section id="services" className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[var(--container)] px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            Services
          </p>
          <h2
            className="mt-3 font-semibold tracking-tight"
            style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.75rem)", lineHeight: 1.1 }}
          >
            Every certificate a property needs, under one roof.
          </h2>
          <p className="mt-4 text-[var(--color-ink-soft)] text-lg">
            Pick one service or bundle all four on the same assignment. One invoice,
            one point of contact, one dashboard.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <ServiceCard key={service.title} service={service} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCard({ service }: { service: Service }) {
  return (
    <article
      className="group relative flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]"
      style={{ borderTopWidth: "3px", borderTopColor: service.colorVar }}
    >
      <div
        className="grid h-11 w-11 place-items-center rounded-lg"
        style={{ backgroundColor: `color-mix(in srgb, ${service.colorVar} 12%, white)`, color: service.colorVar }}
      >
        {service.icon}
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wider" style={{ color: service.colorVar }}>
        {service.tagline}
      </p>
      <h3 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
        {service.title}
      </h3>
      <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
        {service.description}
      </p>

      <Link
        href={`/services/${service.slug}`}
        className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-ink)] transition-colors group-hover:text-[var(--color-brand)]"
      >
        Learn more
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </Link>
    </article>
  );
}

function IconLeaf() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
function IconDroplet() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12 2 12 2 9 6 7 9.5 4 13 4 15a7 7 0 0 0 8 7z" />
    </svg>
  );
}
