import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildLocaleAlternates } from "@/i18n/metadata";

// Login `page.tsx` is a client component (`"use client"`), so it can't host
// `generateMetadata`. We park it on the route's layout — same effect for the
// purposes of canonical + hreflang link tags.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return {
    title: t("title"),
    alternates: await buildLocaleAlternates("/login"),
  };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
