import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MobileNav } from "@/components/MobileNav";
import { BrandLogo } from "@/components/BrandLogo";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";

export default async function Nav() {
  const tNav = await getTranslations("common.nav");
  const tActions = await getTranslations("common.actions");

  return (
    <header className="sticky top-0 z-50 bg-[color-mix(in_srgb,var(--color-bg)_80%,transparent)] backdrop-blur border-b border-[var(--color-border)]">
      <div className="mx-auto flex h-16 max-w-[var(--container)] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center" aria-label={tNav("homeAriaLabel")}>
          <BrandLogo className="h-12 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-[var(--color-ink-soft)]">
          <Link href="/#services" className="hover:text-[var(--color-ink)] transition-colors">
            {tNav("services")}
          </Link>
          <Link href="/#how-it-works" className="hover:text-[var(--color-ink)] transition-colors">
            {tNav("howItWorks")}
          </Link>
          <Link href="/#about" className="hover:text-[var(--color-ink)] transition-colors">
            {tActions("about")}
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher />
          <Link
            href="/login"
            className="hidden sm:inline-block text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            {tActions("login")}
          </Link>
          <Link
            href="/register"
            className="hidden md:inline-block rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-[var(--color-on-brand)] transition-all hover:bg-[var(--color-brand-soft)] hover:shadow-md"
          >
            {tNav("register")}
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
