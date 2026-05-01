import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { IconCheck, IconArrowRight } from "@/components/ui/Icons";
import { SERVICES, ServiceKey } from "@/lib/mockData";
import { buildLocaleAlternates } from "@/i18n/metadata";

// Each service slug renders four bullets in the "What you get" list. ICU
// placeholders aren't supported in our catalog yet, so each bullet is a
// per-slug string addressed by index 0..3.
const BULLET_KEYS = ["bullet1", "bullet2", "bullet3", "bullet4"] as const;

export function generateStaticParams() {
  return (Object.keys(SERVICES) as ServiceKey[]).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { alternates: await buildLocaleAlternates(`/services/${slug}`) };
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
  const t = await getTranslations(`services.${key}`);
  const tShared = await getTranslations("services.shared");

  return (
    <>
      <Nav />
      <main className="flex-1">
        <section
          className="border-b border-[var(--color-border)]"
          style={{ backgroundColor: `color-mix(in srgb, ${svc.color} 6%, var(--color-bg))` }}
        >
          <div className="mx-auto max-w-[var(--container)] px-6 py-20">
            <Link href="/#services" className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
              {tShared("backLink")}
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
              {t("hero")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-[var(--color-ink-soft)]">{t("body")}</p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button href="/register" size="lg">
                {tShared("orderPrefix")} {svc.short}
                <IconArrowRight size={16} />
              </Button>
              <Button href="#how" variant="secondary" size="lg">
                {tShared("howItWorks")}
              </Button>
            </div>
          </div>
        </section>

        <section id="how" className="border-b border-[var(--color-border)]">
          <div className="mx-auto max-w-[var(--container)] px-6 py-20">
            <div className="grid gap-16 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {tShared("whatYouGet")}
                </p>
                <h2
                  className="mt-3 font-semibold tracking-tight"
                  style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)" }}
                >
                  {tShared("everythingHandled")}
                </h2>
                <ul className="mt-8 space-y-4">
                  {BULLET_KEYS.map((bk) => (
                    <li key={bk} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full"
                        style={{ backgroundColor: `color-mix(in srgb, ${svc.color} 15%, white)`, color: svc.color }}
                      >
                        <IconCheck size={14} />
                      </span>
                      <span className="text-[var(--color-ink-soft)]">{t(bk)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-8 space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    {tShared("turnaroundLabel")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                    {t("turnaround")}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    {tShared("regulationLabel")}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{t("regulation")}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    {tShared("whoLabel")}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{t("who")}</p>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {tShared("bundleHeading")}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                    {tShared("bundleBody")}
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
