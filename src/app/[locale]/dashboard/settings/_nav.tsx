"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function SettingsNav() {
  const t = useTranslations("dashboard.settings.nav");
  const pathname = usePathname();
  const items = [
    { href: "/dashboard/settings", label: t("profile") },
    { href: "/dashboard/settings/security", label: t("security") },
    { href: "/dashboard/settings/notifications", label: t("notifications") },
    { href: "/dashboard/settings/appearance", label: t("appearance") },
    { href: "/dashboard/settings/integrations", label: t("integrations") },
  ];
  return (
    <nav
      aria-label={t("ariaLabel")}
      className="flex flex-wrap gap-1 border-b border-[var(--color-border)]"
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              "inline-flex items-center border-b-2 px-3 py-2.5 text-sm transition-colors -mb-px " +
              (active
                ? "border-[var(--color-brand)] font-medium text-[var(--color-ink)]"
                : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]")
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
