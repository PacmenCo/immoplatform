"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import {
  IconHome,
  IconList,
  IconUsers,
  IconBuilding,
  IconCalendar,
  IconChart,
  IconSettings,
  IconMegaphone,
  IconLogout,
} from "@/components/ui/Icons";
import { BrandLogo } from "@/components/BrandLogo";

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function MobileTopbar() {
  const pathname = usePathname();
  const t = useTranslations("dashboard.shared.mobileTopbar");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const NAV = useMemo(
    () => [
      { href: "/dashboard", label: t("items.overview"), icon: IconHome },
      { href: "/dashboard/assignments", label: t("items.assignments"), icon: IconList },
      { href: "/dashboard/teams", label: t("items.teams"), icon: IconBuilding },
      { href: "/dashboard/users", label: t("items.users"), icon: IconUsers },
      { href: "/dashboard/calendar", label: t("items.calendar"), icon: IconCalendar },
      { href: "/dashboard/overview", label: t("items.revenue"), icon: IconChart },
      { href: "/dashboard/announcements", label: t("items.announcements"), icon: IconMegaphone },
      { href: "/dashboard/settings", label: t("items.settings"), icon: IconSettings },
    ],
    [t],
  );

  // Close on route change — Link clicks inside the popover navigate, and we
  // want the panel to go away as the new page paints in.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on outside tap / Escape. Pointerdown fires before click so the
  // tap that opens a link still registers as a navigation.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!wrapperRef.current) return;
      if (e.target instanceof Node && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 sm:px-4 h-14 md:hidden">
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          aria-label={open ? t("close") : t("open")}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
          className="grid h-11 w-11 cursor-pointer place-items-center rounded-md text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
        >
          {open ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          )}
        </button>

        {open && (
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-2 w-72 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2 shadow-[var(--shadow-lg)]"
          >
            <ul className="flex flex-col">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      role="menuitem"
                      aria-current={active ? "page" : undefined}
                      className={
                        "group/link flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors " +
                        (active
                          ? "bg-[var(--color-bg-muted)] text-[var(--color-brand)] font-medium"
                          : "text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]")
                      }
                    >
                      <item.icon
                        size={16}
                        className={
                          "shrink-0 " +
                          (active
                            ? "text-[var(--color-brand)]"
                            : "text-[var(--color-ink-muted)] group-hover/link:text-[var(--color-ink)]")
                        }
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 border-t border-[var(--color-border)] pt-2">
              <Link
                href="/login"
                role="menuitem"
                className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
              >
                <IconLogout size={16} className="shrink-0 text-[var(--color-ink-muted)]" />
                {t("signOut")}
              </Link>
            </div>
          </div>
        )}
      </div>

      <Link href="/dashboard" className="flex items-center" aria-label={t("homeAriaLabel")}>
        <BrandLogo className="h-7 w-auto" />
      </Link>

      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/dashboard/settings"
          aria-label={t("profile")}
          className="grid h-11 w-11 place-items-center rounded-md hover:bg-[var(--color-bg-muted)]"
        >
          <Avatar initials="JR" size="sm" color="#334155" online />
        </Link>
      </div>
    </header>
  );
}
