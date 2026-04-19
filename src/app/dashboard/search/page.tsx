import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, ServicePill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconSearch,
  IconArrowRight,
  IconBuilding,
  IconMapPin,
} from "@/components/ui/Icons";
import {
  ASSIGNMENTS,
  TEAMS,
  USERS,
  SERVICES,
  STATUS_META,
} from "@/lib/mockData";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const hasQuery = query.length > 0;

  const assignments = ASSIGNMENTS.slice(0, 3);
  const teams = TEAMS.slice(0, 2);
  const users = USERS.slice(0, 3);

  return (
    <>
      <Topbar title="Search" subtitle="Find assignments, teams and people" />

      <div className="p-8 space-y-8 max-w-[1100px]">
        <form className="relative" action="/dashboard/search" method="get">
          <IconSearch
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-ink-muted)]"
          />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search assignments, teams, users…"
            className="h-14 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white pl-12 pr-4 text-base placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/10"
            autoFocus
          />
        </form>

        {!hasQuery ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={<IconSearch size={22} />}
                title="Start typing to search"
                description="Search across all assignments, teams, and users. Results appear here as you type."
              />
            </CardBody>
          </Card>
        ) : (
          <>
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                  Assignments
                </h2>
                <span className="text-xs text-[var(--color-ink-muted)]">
                  {assignments.length} results
                </span>
              </div>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-[var(--color-border)]">
                  {assignments.map((a) => {
                    const meta = STATUS_META[a.status];
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/dashboard/assignments/${a.id}`}
                          className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-[var(--color-bg-alt)]"
                        >
                          <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-ink-soft)]">
                            <IconMapPin size={18} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-[var(--color-ink)]">
                                {a.address}, {a.postal} {a.city}
                              </p>
                              <span className="text-xs text-[var(--color-ink-muted)]">
                                {a.reference}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                              {a.services.map((s) => (
                                <ServicePill
                                  key={s}
                                  color={SERVICES[s].color}
                                  label={SERVICES[s].short}
                                />
                              ))}
                            </div>
                          </div>
                          <Badge bg={meta.bg} fg={meta.fg}>
                            {meta.label}
                          </Badge>
                          <IconArrowRight
                            size={16}
                            className="text-[var(--color-ink-muted)]"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                  Teams
                </h2>
                <span className="text-xs text-[var(--color-ink-muted)]">
                  {teams.length} results
                </span>
              </div>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-[var(--color-border)]">
                  {teams.map((t) => (
                    <li key={t.id}>
                      <Link
                        href="/dashboard/teams"
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-[var(--color-bg-alt)]"
                      >
                        <span
                          className="grid h-10 w-10 place-items-center rounded-md font-semibold text-white"
                          style={{ backgroundColor: t.color }}
                          aria-hidden
                        >
                          {t.logo}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--color-ink)]">
                            {t.name}
                          </p>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-[var(--color-ink-muted)]">
                            <span className="inline-flex items-center gap-1">
                              <IconBuilding size={12} />
                              {t.city}
                            </span>
                            <span>
                              {t.members} members · {t.active} active
                            </span>
                          </div>
                        </div>
                        <IconArrowRight
                          size={16}
                          className="text-[var(--color-ink-muted)]"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                  Users
                </h2>
                <span className="text-xs text-[var(--color-ink-muted)]">
                  {users.length} results
                </span>
              </div>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-[var(--color-border)]">
                  {users.map((u) => (
                    <li key={u.id}>
                      <Link
                        href="/dashboard/users"
                        className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-[var(--color-bg-alt)]"
                      >
                        <Avatar initials={u.avatar} size="md" online={u.online} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--color-ink)]">
                            {u.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
                            {u.email}
                          </p>
                        </div>
                        <Badge>{u.role}</Badge>
                        <IconArrowRight
                          size={16}
                          className="text-[var(--color-ink-muted)]"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          </>
        )}

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            Tips
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">By reference</CardTitle>
              </CardHeader>
              <CardBody className="text-sm text-[var(--color-ink-soft)]">
                Paste an assignment reference like{" "}
                <code className="rounded bg-[var(--color-bg-muted)] px-1.5 py-0.5 text-xs">
                  ASG-2026-1001
                </code>{" "}
                to jump straight there.
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">By city</CardTitle>
              </CardHeader>
              <CardBody className="text-sm text-[var(--color-ink-soft)]">
                Narrow down by searching a city name — Antwerpen, Gent, Brussels.
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">By email</CardTitle>
              </CardHeader>
              <CardBody className="text-sm text-[var(--color-ink-soft)]">
                Search a user&apos;s email address to see their profile and recent work.
              </CardBody>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}
