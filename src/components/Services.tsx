import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type ServiceMeta = {
  slug: "epc" | "asbestos" | "electrical" | "fuel" | "photos" | "signage";
  colorVar: string;
  icon: React.ReactNode;
};

// Service codes (EPC/AIV/EK/TK/PH/SG) and visual metadata stay in code;
// titles, taglines, descriptions, when-needed and validity are translated.
const SERVICE_META: ServiceMeta[] = [
  { slug: "epc", colorVar: "var(--color-epc)", icon: <IconLeaf /> },
  { slug: "asbestos", colorVar: "var(--color-asbestos)", icon: <IconShield /> },
  { slug: "electrical", colorVar: "var(--color-electrical)", icon: <IconBolt /> },
  { slug: "fuel", colorVar: "var(--color-fuel)", icon: <IconDroplet /> },
  { slug: "photos", colorVar: "var(--color-photos)", icon: <IconCamera /> },
  { slug: "signage", colorVar: "var(--color-signage)", icon: <IconSign /> },
];

export default async function Services() {
  const t = await getTranslations("home.services");

  return (
    <section id="services" className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[var(--container)] px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            {t("eyebrow")}
          </p>
          <h2
            className="mt-3 font-semibold tracking-tight"
            style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.75rem)", lineHeight: 1.1 }}
          >
            {t("heading")}
          </h2>
          <p className="mt-4 text-[var(--color-ink-soft)] text-lg">
            {t("lead")}
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICE_META.map((meta) => (
            <ServiceCard
              key={meta.slug}
              meta={meta}
              title={t(`cards.${meta.slug}.title`)}
              tagline={t(`cards.${meta.slug}.tagline`)}
              description={t(`cards.${meta.slug}.description`)}
              whenNeeded={t(`cards.${meta.slug}.whenNeeded`)}
              validity={t(`cards.${meta.slug}.validity`)}
              whenLabel={t("whenLabel")}
              validityLabel={t("validityLabel")}
              learnMore={t("learnMore")}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCard({
  meta,
  title,
  tagline,
  description,
  whenNeeded,
  validity,
  whenLabel,
  validityLabel,
  learnMore,
}: {
  meta: ServiceMeta;
  title: string;
  tagline: string;
  description: string;
  whenNeeded: string;
  validity: string;
  whenLabel: string;
  validityLabel: string;
  learnMore: string;
}) {
  return (
    <article
      className="group relative flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]"
      style={{ borderTopWidth: "3px", borderTopColor: meta.colorVar }}
    >
      <div
        className="grid h-11 w-11 place-items-center rounded-lg"
        style={{ backgroundColor: `color-mix(in srgb, ${meta.colorVar} 12%, white)`, color: meta.colorVar }}
      >
        {meta.icon}
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wider" style={{ color: meta.colorVar }}>
        {tagline}
      </p>
      <h3 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
        {title}
      </h3>
      <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
        {description}
      </p>

      <dl className="mt-5 space-y-2 border-t border-[var(--color-border)] pt-4 text-xs">
        <div>
          <dt className="font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            {whenLabel}
          </dt>
          <dd className="mt-0.5 text-[var(--color-ink-soft)]">{whenNeeded}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            {validityLabel}
          </dt>
          <dd className="mt-0.5 text-[var(--color-ink-soft)]">{validity}</dd>
        </div>
      </dl>

      <Link
        href={`/services/${meta.slug}`}
        className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-ink)] transition-colors group-hover:text-[var(--color-brand)]"
      >
        {learnMore}
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
