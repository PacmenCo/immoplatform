import { Link } from "@/i18n/navigation";

type Service = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  whenNeeded: string;
  validity: string;
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
      "Energy-performance rating shown on the property listing. The certificate displays the energy class (A → G) and must be available before the property is advertised for sale or rent.",
    whenNeeded: "Before advertising a sale or rental",
    validity: "10 years",
    colorVar: "var(--color-epc)",
    badge: "EPC",
    icon: <IconLeaf />,
  },
  {
    slug: "asbestos",
    title: "Asbestos Inventory Attest",
    tagline: "AIV",
    description:
      "Mandatory in Flanders since November 2022 for the sale of any residential property built before 2001. Issued by an OVAM-certified inspector after a non-destructive site inventory.",
    whenNeeded: "Sale of pre-2001 buildings (Flanders)",
    validity: "Up to 10 years",
    colorVar: "var(--color-asbestos)",
    badge: "AIV",
    icon: <IconShield />,
  },
  {
    slug: "electrical",
    title: "Electrical Inspection",
    tagline: "EK",
    description:
      "AREI/RGIE installation check covering the safety of the electrical system. Required at every residential sale and after major renovations of the installation.",
    whenNeeded: "On every residential sale",
    validity: "25 years if approved · 18 months to remediate if not",
    colorVar: "var(--color-electrical)",
    badge: "EK",
    icon: <IconBolt />,
  },
  {
    slug: "fuel",
    title: "Fuel Tank Check",
    tagline: "TK",
    description:
      "Periodic inspection of residential heating-oil tanks, above-ground or buried. The certificate confirms the tank meets regional regulations and may continue to be used.",
    whenNeeded: "Periodic — frequency depends on tank type",
    validity: "Reissued at each inspection",
    colorVar: "var(--color-fuel)",
    badge: "TK",
    icon: <IconDroplet />,
  },
  {
    slug: "photos",
    title: "Property Photography",
    tagline: "PH",
    description:
      "Wide-angle, professionally-lit listing photography for sales and rentals. Edited and delivered the same day so your listing goes live without a wait.",
    whenNeeded: "Before publishing the listing",
    validity: "Same-day delivery",
    colorVar: "var(--color-photos)",
    badge: "PH",
    icon: <IconCamera />,
  },
  {
    slug: "signage",
    title: "On-site Signage",
    tagline: "SG",
    description:
      "We deliver and mount For-Sale or For-Rent signage at the property, branded with your agency. Pickup and removal handled when the listing closes.",
    whenNeeded: "Day the listing goes live",
    validity: "Removed when the listing closes",
    colorVar: "var(--color-signage)",
    badge: "SG",
    icon: <IconSign />,
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

      <dl className="mt-5 space-y-2 border-t border-[var(--color-border)] pt-4 text-xs">
        <div>
          <dt className="font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            When
          </dt>
          <dd className="mt-0.5 text-[var(--color-ink-soft)]">{service.whenNeeded}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            Validity
          </dt>
          <dd className="mt-0.5 text-[var(--color-ink-soft)]">{service.validity}</dd>
        </div>
      </dl>

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
function IconCamera() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function IconSign() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v20" />
      <path d="M5 6h14l-2 4 2 4H5z" />
    </svg>
  );
}
