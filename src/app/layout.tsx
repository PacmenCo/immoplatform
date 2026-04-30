import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces, Montserrat } from "next/font/google";
import "./globals.css";
import { SkipLink } from "@/components/ui/SkipLink";
import { ThemeScript } from "@/components/theme/ThemeScript";
import { UnsavedChangesProvider } from "@/components/dashboard/UnsavedChangesProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

// Homepage typeface. Proxima Nova is the brand target but it's a paid Adobe
// licence — Montserrat is the closest open-source stand-in and is what we
// ship until the licence is procured. To swap: replace this loader with the
// licensed Proxima Nova @font-face, keep the `--font-proxima` variable name.
const proxima = Montserrat({
  variable: "--font-proxima",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
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
  openGraph: {
    type: "website",
    locale: "en_US",
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

export const viewport: Viewport = {
  // Matches --color-brand token in globals.css; kept in sync with manifest.ts.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f172a" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${proxima.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <SkipLink />
        <ToastProvider>
          <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
