import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { buildLocaleAlternates } from "@/i18n/metadata";
import { routing, type Locale } from "@/i18n/routing";
import EnContent from "./en";
import NlBeContent from "./nl-BE";

// Dispatch loader for the terms of service. Each locale ships its content as
// a standalone .tsx file (`./en.tsx`, `./nl-BE.tsx`) so legal counsel can
// review each language end-to-end as a complete document. The shared chrome
// (Nav, Footer, hreflang/canonical metadata) lives here so the per-locale
// files stay focused on text + structure.
//
// Adding a new locale: drop a sibling `<locale>.tsx` (mirror the structure of
// `en.tsx`), register it in `CONTENT` below, done. No catalog edits required.

const CONTENT: Record<Locale, () => React.ReactElement> = {
  en: EnContent,
  "nl-BE": NlBeContent,
};

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: await buildLocaleAlternates("/legal/terms") };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const Content = CONTENT[locale];
  return (
    <>
      <Nav />
      <main>
        <Content />
      </main>
      <Footer />
    </>
  );
}
