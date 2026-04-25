"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import {
  IconHome,
  IconList,
  IconUsers,
  IconBuilding,
  IconCalendar,
  IconChart,
  IconSettings,
  IconBell,
  IconMegaphone,
  IconLogout,
} from "@/components/ui/Icons";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: IconHome },
  { href: "/dashboard/assignments", label: "Assignments", icon: IconList },
  { href: "/dashboard/teams", label: "Teams", icon: IconBuilding },
  { href: "/dashboard/users", label: "Users", icon: IconUsers },
  { href: "/dashboard/calendar", label: "Calendar", icon: IconCalendar },
  { href: "/dashboard/overview", label: "Revenue", icon: IconChart },
  { href: "/dashboard/announcements", label: "Announcements", icon: IconMegaphone },
  { href: "/dashboard/settings", label: "Settings", icon: IconSettings },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function MobileTopbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
          aria-label={open ? "Close navigation" : "Open navigation"}
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
                Sign out
              </Link>
            </div>
          </div>
        )}
      </div>

      <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-brand)] text-[var(--color-on-brand)] text-xs font-bold">
          I
        </span>
        <span className="text-sm">Immo</span>
      </Link>

      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/dashboard/notifications"
          aria-label="Notifications"
          className="relative grid h-11 w-11 place-items-center rounded-md text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
        >
          <IconBell size={18} />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[var(--color-asbestos)]" />
        </Link>
        <Link
          href="/dashboard/settings"
          aria-label="Your profile"
          className="grid h-11 w-11 place-items-center rounded-md hover:bg-[var(--color-bg-muted)]"
        >
          <Avatar initials="JR" size="sm" color="#0f172a" online />
        </Link>
      </div>
    </header>
  );
}
