"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

const LABEL_OVERRIDES: Record<string, string> = {
  dashboard: "Dashboard",
  assignments: "Assignments",
  overview: "Overview",
  teams: "Teams",
  users: "Users",
  admin: "Admin",
  settings: "Settings",
  announcements: "Announcements",
  activity: "Activity",
  calendar: "Calendar",
  freelancer: "Freelancer",
  new: "New",
  edit: "Edit",
  files: "Files",
};

function titleCase(segment: string): string {
  return segment
    .split(/[-_]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function formatAssignmentId(raw: string): string {
  const m = raw.match(/^a_(\d+)$/i);
  if (!m) return raw.toUpperCase();
  const year = new Date().getFullYear();
  return `ASG-${year}-${m[1]}`;
}

function labelForSegment(segment: string, prevSegment: string | undefined): string {
  const key = segment.toLowerCase();
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];

  if (prevSegment === "assignments" && /^a_\d+/i.test(segment)) {
    return formatAssignmentId(segment);
  }

  if (/^[a-z]+_\d+/i.test(segment)) {
    return segment.toUpperCase();
  }

  return titleCase(decodeURIComponent(segment));
}

function deriveItems(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [];
  let acc = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    acc += `/${seg}`;
    const label = labelForSegment(seg, segments[i - 1]);
    items.push({
      label,
      href: i === segments.length - 1 ? undefined : acc,
    });
  }
  return items;
}

function ChevronSeparator() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0 text-[var(--color-ink-faint)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M7.5 4.5L13 10l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Breadcrumbs({
  items,
  className,
}: {
  items?: BreadcrumbItem[];
  className?: string;
}) {
  const pathname = usePathname() ?? "/";
  const trail = items ?? deriveItems(pathname);

  if (trail.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center text-sm text-[var(--color-ink-muted)]",
        className,
      )}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {trail.map((item, idx) => {
          const isLast = idx === trail.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
              {idx > 0 && <ChevronSeparator />}
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    "truncate",
                    isLast
                      ? "font-semibold text-[var(--color-ink)]"
                      : "text-[var(--color-ink-muted)]",
                  )}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="truncate rounded-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
