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
  IconMegaphone,
  IconWallet,
  IconLogout,
  IconMail,
} from "@/components/ui/Icons";
import { logout } from "@/app/actions/auth";
import { BrandLogo } from "@/components/BrandLogo";

type NavRole = "admin" | "staff" | "realtor" | "freelancer";

type NavItem = {
  href: string;
  label: string;
  icon: (p: { size?: number; className?: string }) => React.ReactElement;
  badge?: string;
  visibleFor?: NavRole[]; // omitted = everyone
};

const sections: Array<{ heading?: string; headingHref?: string; items: NavItem[] }> = [
  {
    items: [
      { href: "/dashboard/assignments", label: "Assignments", icon: IconList },
    ],
  },
  {
    items: [
      {
        href: "/dashboard/users",
        label: "Users",
        icon: IconUsers,
        visibleFor: ["admin", "staff"],
      },
      {
        href: "/dashboard/teams",
        label: "Teams",
        icon: IconBuilding,
        visibleFor: ["admin", "staff", "realtor"],
      },
    ],
  },
  {
    items: [
      { href: "/dashboard", label: "Overview", icon: IconHome },
      { href: "/dashboard/calendar", label: "Calendar", icon: IconCalendar },
    ],
  },
  {
    heading: "Admin",
    headingHref: "/dashboard/admin",
    items: [
      {
        href: "/dashboard/overview",
        label: "Revenue",
        icon: IconChart,
        visibleFor: ["admin"],
      },
      {
        href: "/dashboard/commissions",
        label: "Commissions",
        icon: IconWallet,
        visibleFor: ["admin"],
      },
      {
        href: "/dashboard/contact-messages",
        label: "Messages",
        icon: IconMail,
        visibleFor: ["admin"],
      },
      {
        href: "/dashboard/announcements",
        label: "Announcements",
        icon: IconMegaphone,
        visibleFor: ["admin"],
      },
    ],
  },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

type SidebarUser = {
  firstName: string;
  lastName: string;
  role: string;
  avatarInitials: string;
  avatarUrl: string | null;
};

type SidebarProps = {
  user?: SidebarUser;
  /** Count of contact_submissions where handledAt IS NULL — rendered as a
   *  badge on the Messages item. Computed in the dashboard layout for admins
   *  only; falsy / 0 means no badge shown. */
  unreadContactCount?: number;
};

export function Sidebar({ user, unreadContactCount }: SidebarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(e: PointerEvent) {
      if (!menuRef.current) return;
      if (e.target instanceof Node && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)] sticky top-0">
      <div className="flex items-center px-6 h-16 border-b border-[var(--color-border)]">
        <Link href="/dashboard" aria-label="immoplatform.be — dashboard">
          <BrandLogo className="h-9 w-auto" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections
          .map((section) => ({
            ...section,
            items: section.items.filter(
              (item) =>
                !item.visibleFor ||
                (user && item.visibleFor.includes(user.role as NavRole)),
            ),
          }))
          .filter((section) => section.items.length > 0)
          .map((section, idx) => (
            <div
              key={section.heading ?? idx}
              className={
                idx > 0
                  ? "mt-3 border-t border-[var(--color-border)] pt-3"
                  : ""
              }
            >
              {section.heading &&
                (section.headingHref ? (
                  <Link
                    href={section.headingHref}
                    className="block px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]"
                  >
                    {section.heading}
                  </Link>
                ) : (
                  <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    {section.heading}
                  </div>
                ))}
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const badge =
                    item.href === "/dashboard/contact-messages" && unreadContactCount
                      ? String(unreadContactCount)
                      : item.badge;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={
                          "group relative flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors " +
                          (active
                            ? "bg-[var(--color-bg-muted)] text-[var(--color-brand)] font-medium before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-[var(--color-brand)]"
                            : "text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]")
                        }
                      >
                        <span className="flex items-center gap-3">
                          <item.icon
                            size={18}
                            className={
                              "shrink-0 " +
                              (active
                                ? "text-[var(--color-brand)]"
                                : "text-[var(--color-ink-muted)] group-hover:text-[var(--color-ink)]")
                            }
                          />
                          {item.label}
                        </span>
                        {badge && (
                          <span
                            className={
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums " +
                              (active
                                ? "bg-[var(--color-brand)] text-white"
                                : "bg-[var(--color-accent)] text-[var(--color-brand)]")
                            }
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </nav>

      <div ref={menuRef} className="relative border-t border-[var(--color-border)] p-3">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--color-bg-muted)]"
        >
          <Avatar
            initials={user?.avatarInitials ?? "JR"}
            imageUrl={user?.avatarUrl ?? null}
            size="sm"
            color="#334155"
            online
          />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-[var(--color-ink)] truncate">
              {user ? `${user.firstName} ${user.lastName}` : "Jordan Remy"}
            </span>
            <span className="text-xs capitalize text-[var(--color-ink-muted)] truncate">
              {user?.role ?? "admin"}
            </span>
          </div>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={
              "shrink-0 text-[var(--color-ink-muted)] transition-transform " +
              (menuOpen ? "rotate-180" : "")
            }
          >
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute bottom-full left-3 right-3 mb-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-1 shadow-[var(--shadow-lg)]"
          >
            <Link
              href="/dashboard/settings"
              role="menuitem"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
            >
              <IconSettings size={16} className="shrink-0 text-[var(--color-ink-muted)]" />
              Settings
            </Link>
            <form action={logout}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
              >
                <IconLogout size={16} className="shrink-0 text-[var(--color-ink-muted)]" />
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
