import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import "../globals.css";
import { SkipLink } from "@/components/ui/SkipLink";
import { ThemeScript } from "@/components/theme/ThemeScript";
import { UnsavedChangesProvider } from "@/components/dashboard/UnsavedChangesProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { routing } from "@/i18n/routing";

// Universal sans for the entire app — marketing, dashboard, headlines, body,
// even monospace contexts (`font-mono` is repointed at this same variable in
// globals.css, so reference codes / activity timestamps still resolve to
// Montserrat). Proxima Nova is the brand target but it's a paid Adobe licence;
// Montserrat is the closest open-source stand-in and ships under the
// `--font-proxima` variable so the swap is a one-loader change later.
const proxima = Montserrat({
  variable: "--font-proxima",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(
  props: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await props.params;
  // OpenGraph uses underscore-form locales (BCP-47 dashes are invalid here).
  // `en` maps to en_US (Anglosphere convention; English visitors are mostly UK/US).
  const ogLocale = locale === "nl-BE" ? "nl_BE" : "en_US";
  return {
    metadataBase: new URL(SITE_URL),
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    appleWebApp: {
      capable: true,
      title: SITE_NAME,
      statusBarStyle: "default",
    },
    icons: {
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    // hreflang + canonical are emitted per-page via `buildLocaleAlternates`
    // (see src/i18n/metadata.ts). Setting `alternates.languages` here would be
    // applied wholesale to every nested page, which mis-points hreflang at the
    // homepage of each locale instead of the page's own counterpart.
    openGraph: {
      type: "website",
      locale: ogLocale,
      url: SITE_URL,
      siteName: SITE_NAME,
      title: `${SITE_NAME} — ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
      // og:image is auto-emitted from app/opengraph-image.tsx
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE_NAME} — ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
      // twitter:image inherits from og:image when not specified
    },
    // Note: next auto-emits <link rel="manifest" href="/manifest.webmanifest"> from app/manifest.ts.
  };
}

export const viewport: Viewport = {
  // Matches --color-brand token in globals.css; kept in sync with manifest.ts.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f172a" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required for static rendering of [locale] routes.
  setRequestLocale(locale);

  const messages = await getMessages();

  // <html lang> uses the BCP-47 form (`nl-BE`); URL segment stays short via routing.prefixes.
  return (
    <html
      lang={locale}
      className={`${proxima.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <SkipLink />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>
            <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
