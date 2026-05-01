"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

// Tiny dropdown — keeps the rest of the path intact and lets next-intl
// re-render the new locale's messages. Cookie persistence is handled by
// the middleware on the next navigation.
export function LocaleSwitcher() {
  const t = useTranslations("common.localeSwitcher");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onChange(next: string) {
    if (next === locale) return;
    startTransition(() => {
      // `usePathname()` already returns the locale-stripped path with
      // dynamic segments resolved, so it round-trips correctly under any
      // [slug]/[id] route.
      router.replace(pathname, { locale: next as Locale });
    });
  }

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value)}
        disabled={isPending}
        className="appearance-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] py-1.5 pl-2.5 pr-7 text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none disabled:opacity-60"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {t(l)}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-2 h-3 w-3 text-[var(--color-ink-muted)]"
      >
        <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
