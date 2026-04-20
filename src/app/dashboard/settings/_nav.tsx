"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard/settings", label: "Profile" },
  { href: "/dashboard/settings/security", label: "Security" },
  { href: "/dashboard/settings/notifications", label: "Notifications" },
  { href: "/dashboard/settings/appearance", label: "Appearance" },
  { href: "/dashboard/settings/integrations", label: "Integrations" },
  { href: "/dashboard/settings/team", label: "Team" },
  { href: "/dashboard/settings/branding", label: "Branding" },
  { href: "/dashboard/settings/billing", label: "Billing" },
  { href: "/dashboard/settings/api", label: "API" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings"
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
