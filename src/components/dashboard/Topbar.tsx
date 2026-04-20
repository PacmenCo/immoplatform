import { IconSearch, IconBell, IconPlus } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import { TeamSwitcher } from "./TeamSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="hidden lg:flex items-center justify-between gap-4 xl:gap-6 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-6 xl:px-8 h-16 sticky top-0 z-40">
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[var(--color-ink)] truncate">{title}</h1>
          {subtitle && <p className="text-xs text-[var(--color-ink-muted)] truncate">{subtitle}</p>}
        </div>
        <span className="h-8 w-px bg-[var(--color-border)]" aria-hidden />
        <TeamSwitcher />
      </div>

      <div className="flex flex-1 max-w-md items-center">
        <div className="relative w-full">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-muted)]" />
          <input
            type="search"
            placeholder="Search assignments, teams, users…"
            className="w-full h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] pl-9 pr-12 text-sm placeholder:text-[var(--color-ink-faint)] transition-colors hover:bg-[var(--color-bg)] hover:border-[var(--color-border-strong)] focus:bg-[var(--color-bg)] focus:border-[var(--color-ink-soft)] focus:ring-2 focus:ring-[var(--color-brand)]/10 focus:outline-none"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden xl:inline-flex h-5 items-center gap-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 text-[10px] font-medium text-[var(--color-ink-muted)]">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <button
          type="button"
          className="relative grid h-9 w-9 place-items-center rounded-md text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
          aria-label="Notifications"
        >
          <IconBell size={18} />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--color-asbestos)]" />
        </button>
        <Button href="/dashboard/assignments/new" size="sm" className="ml-1.5">
          <IconPlus size={16} />
          New assignment
        </Button>
      </div>
    </header>
  );
}
