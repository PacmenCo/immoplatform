import Link from "next/link";
import { cn } from "@/lib/cn";

export type TabItem = {
  label: string;
  href: string;
  active?: boolean;
};

export function Tabs({
  tabs,
  className,
}: {
  tabs: TabItem[];
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "flex items-center gap-6 border-b border-[var(--color-border)]",
        className,
      )}
      aria-label="Tabs"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "relative -mb-px inline-flex h-10 items-center border-b-2 px-1 text-sm font-medium transition-colors",
            t.active
              ? "border-[var(--color-brand)] text-[var(--color-ink)]"
              : "border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]",
          )}
          aria-current={t.active ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
