import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { ServicePill } from "@/components/ui/Badge";
import { SERVICES } from "@/lib/mockData";
import { BrandName } from "@/components/BrandName";
import { buildLocaleAlternates } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: await buildLocaleAlternates("/about") };
}

const TIMELINE_ITEMS = [
  { key: "founded2011", tag: "asbestos" as const },
  { key: "epc2015", tag: "epc" as const },
  { key: "electrical2018", tag: "electrical" as const },
  { key: "fuel2021", tag: "fuel" as const },
  { key: "launch2026", tag: null },
] as const;

const VALUES_KEYS = [
  "oneFile",
  "specialists",
  "transparent",
  "belgium",
  "inspectorFriendly",
  "receipts",
] as const;

export default async function AboutPage() {
  const t = await getTranslations("home.about");
  return (
    <>
      <Nav />
      <main>
        <section className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          <div className="mx-auto max-w-[var(--container)] px-6 py-24 md:py-32">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs font-medium text-[var(--color-ink-soft)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                {t("hero.badgePrefix")} <BrandName />
              </span>
              <h1
                className="mt-6 font-semibold tracking-tight text-[var(--color-ink)]"
                style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1.05 }}
              >
                {t("hero.title")}
              </h1>
              <p
                className="mt-6 max-w-2xl text-[var(--color-ink-soft)]"
                style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.25rem)" }}
              >
                {t("hero.subtitle")}
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-[var(--container)] px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
                {t("timeline.heading")}
              </h2>
              <p className="mt-3 text-[var(--color-ink-soft)]">
                {t("timeline.subheading")}
              </p>
            </div>

            <ol className="relative mt-12 space-y-10 border-l border-[var(--color-border)] pl-8">
              {TIMELINE_ITEMS.map((item) => {
                const svc = item.tag ? SERVICES[item.tag] : null;
                const year = t(`timeline.items.${item.key}.year`);
                return (
                  <li key={item.key} className="relative">
                    <span
                      className="absolute -left-[2.1rem] top-1.5 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-[var(--color-ink)]"
                      style={svc ? { background: svc.color } : undefined}
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                        {year}
                      </span>
                      {svc && <ServicePill color={svc.color} label={svc.short} />}
                    </div>
                    <h3 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">
                      {t(`timeline.items.${item.key}.title`)}
                    </h3>
                    <p className="mt-2 max-w-2xl text-[var(--color-ink-soft)]">
                      {t(`timeline.items.${item.key}.body`)}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-alt)] py-20">
          <div className="mx-auto max-w-[var(--container)] px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
                {t("values.heading")}
              </h2>
              <p className="mt-3 text-[var(--color-ink-soft)]">
                {t("values.subheading")}
              </p>
            </div>

            <div className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-3">
              {VALUES_KEYS.map((k) => (
                <div key={k} className="bg-[var(--color-bg)] p-8">
                  <h3 className="text-base font-semibold text-[var(--color-ink)]">
                    {t(`values.items.${k}.title`)}
                  </h3>
                  <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                    {t(`values.items.${k}.body`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-alt)] py-20">
          <div className="mx-auto max-w-[var(--container)] px-6 text-center">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-[var(--color-ink)] md:text-4xl">
              {t("cta.heading")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--color-ink-soft)]">
              {t("cta.body")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button href="/register" size="lg">
                {t("cta.register")}
              </Button>
              <Button href="/contact" size="lg" variant="secondary">
                {t("cta.contact")}
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
