import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { ContactForm } from "@/components/ContactForm";
import { buildLocaleAlternates } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: await buildLocaleAlternates("/contact") };
}

export default async function ContactPage() {
  const t = await getTranslations("home.contact");
  return (
    <>
      <Nav />
      <main>
        <section className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          <div className="mx-auto max-w-[var(--container)] px-6 py-20 md:py-28">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs font-medium text-[var(--color-ink-soft)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-fuel)]" />
                {t("hero.badge")}
              </span>
              <h1
                className="mt-6 font-semibold tracking-tight text-[var(--color-ink)]"
                style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.05 }}
              >
                {t("hero.title")}
              </h1>
              <p className="mt-5 max-w-2xl text-[var(--color-ink-soft)]" style={{ fontSize: "clamp(1rem, 1.4vw, 1.15rem)" }}>
                {t("hero.subtitle")}
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
              {t("form.heading")}
            </h2>
            <p className="mt-2 text-[var(--color-ink-soft)]">
              {t("form.subheading")}
            </p>

            <ContactForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
