import { getTranslations } from "next-intl/server";
import { TAP_TARGET_LINK } from "@/components/ui/tap-target";
import { BrandName } from "@/components/BrandName";
import { BrandLogo } from "@/components/BrandLogo";

export default async function Footer() {
  const tFooter = await getTranslations("common.footer");
  const tNav = await getTranslations("common.nav");

  const columns = [
    {
      title: tFooter("columns.services.title"),
      links: [
        { label: tFooter("columns.services.links.epc"), href: "/services/epc" },
        { label: tFooter("columns.services.links.asbestos"), href: "/services/asbestos" },
        { label: tFooter("columns.services.links.electrical"), href: "/services/electrical" },
        { label: tFooter("columns.services.links.fuel"), href: "/services/fuel" },
      ],
    },
    {
      title: tFooter("columns.company.title"),
      links: [
        { label: tFooter("columns.company.links.about"), href: "/about" },
        { label: tFooter("columns.company.links.contact"), href: "/contact" },
      ],
    },
    {
      title: tFooter("columns.account.title"),
      links: [
        { label: tFooter("columns.account.links.login"), href: "/login" },
        { label: tFooter("columns.account.links.register"), href: "/register" },
      ],
    },
    {
      title: tFooter("columns.legal.title"),
      links: [
        { label: tFooter("columns.legal.links.privacy"), href: "/legal/privacy" },
        { label: tFooter("columns.legal.links.terms"), href: "/legal/terms" },
        { label: tFooter("columns.legal.links.cookies"), href: "/legal/cookies" },
      ],
    },
  ];

  return (
    <footer className="bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[var(--container)] px-6 py-16">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-1">
            <a href="/" className="inline-flex items-center" aria-label={tNav("homeAriaLabel")}>
              <BrandLogo className="h-12 w-auto" />
            </a>
            <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
              {tFooter("tagline")}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                {col.title}
              </p>
              <ul className="mt-4 space-y-1">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className={`${TAP_TARGET_LINK} text-sm transition-colors`}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-[var(--color-border)] pt-8 sm:flex-row sm:items-center">
          <p className="text-sm text-[var(--color-ink-muted)]">
            {tFooter.rich("copyright", {
              year: new Date().getFullYear(),
              brand: () => <BrandName />,
            })}
          </p>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {tFooter("brandsLine")}
          </p>
        </div>
      </div>
    </footer>
  );
}
