"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

type NavRole = "admin" | "staff" | "realtor" | "freelancer";

const nav: Array<{
  href: string;
  label: string;
  icon: (p: { size?: number; className?: string }) => React.ReactElement;
  badge?: string;
  visibleFor?: NavRole[]; // omitted = everyone
}> = [
  { href: "/dashboard", label: "Overview", icon: IconHome },
  { href: "/dashboard/assignments", label: "Assignments", icon: IconList },
  { href: "/dashboard/calendar", label: "Calendar", icon: IconCalendar },
  {
    href: "/dashboard/teams",
    label: "Teams",
    icon: IconBuilding,
    visibleFor: ["admin", "staff", "realtor"],
  },
  {
    href: "/dashboard/users",
    label: "Users",
    icon: IconUsers,
    visibleFor: ["admin", "staff"],
  },
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
    href: "/dashboard/announcements",
    label: "Announcements",
    icon: IconMegaphone,
    visibleFor: ["admin"],
  },
  {
    href: "/dashboard/contact-messages",
    label: "Messages",
    icon: IconMail,
    visibleFor: ["admin"],
  },
  { href: "/dashboard/settings", label: "Settings", icon: IconSettings },
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

export function Sidebar({ user }: { user?: SidebarUser }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)] sticky top-0">
      <div className="flex items-center gap-2 px-6 h-16 border-b border-[var(--color-border)]">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--color-brand)] text-white text-sm font-bold">
          I
        </span>
        <span className="font-semibold tracking-tight">Immo</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {nav
            .filter(
              (item) =>
                !item.visibleFor ||
                (user && item.visibleFor.includes(user.role as NavRole)),
            )
            .map((item) => {
            const active = isActive(pathname, item.href);
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
                  {item.badge && (
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums " +
                        (active
                          ? "bg-[var(--color-brand)] text-white"
                          : "bg-[var(--color-accent)] text-[var(--color-brand)]")
                      }
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-[var(--color-border)] p-3">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-[var(--color-bg-muted)]"
        >
          <Avatar
            initials={user?.avatarInitials ?? "JR"}
            imageUrl={user?.avatarUrl ?? null}
            size="sm"
            color="#334155"
            online
          />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-[var(--color-ink)] truncate">
              {user ? `${user.firstName} ${user.lastName}` : "Jordan Remy"}
            </span>
            <span className="text-xs capitalize text-[var(--color-ink-muted)] truncate">
              {user?.role ?? "admin"}
            </span>
          </div>
        </Link>
        <form action={logout} className="mt-1">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
          >
            <IconLogout size={16} className="text-[var(--color-ink-muted)]" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
