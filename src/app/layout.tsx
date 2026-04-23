import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { SkipLink } from "@/components/ui/SkipLink";
import { ThemeScript } from "@/components/theme/ThemeScript";
import { UnsavedChangesProvider } from "@/components/dashboard/UnsavedChangesProvider";

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

export const metadata: Metadata = {
  title: "Immo — One platform for every real-estate certificate",
  description:
    "Energy Performance Certificates, Asbestos Inventory Attests, Electrical Inspections and Fuel Tank Checks for Belgian real-estate agents. One dashboard, one invoice, one team of experts.",
  applicationName: "Immo",
  appleWebApp: {
    capable: true,
    title: "Immo",
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <SkipLink />
        <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
      </body>
    </html>
  );
}
