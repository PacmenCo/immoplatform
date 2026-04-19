import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge, ServicePill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconArrowRight, IconCheck, IconList, IconCalendar } from "@/components/ui/Icons";
import {
  ASSIGNMENTS,
  DASHBOARD_STATS,
  RECENT_ACTIVITY,
  SERVICES,
  STATUS_META,
} from "@/lib/mockData";

export default function DashboardHome() {
  const upcoming = ASSIGNMENTS.filter((a) =>
    ["scheduled", "in_progress"].includes(a.status),
  ).slice(0, 4);

  return (
    <>
      <Topbar title="Overview" subtitle="Welcome back, Jordan" />
      <div className="p-8 space-y-8 max-w-[1400px]">
        <section aria-labelledby="stats-title">
          <h2 id="stats-title" className="sr-only">
            Key metrics
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DASHBOARD_STATS.map((s) => (
              <Card key={s.label} className="p-6">
                <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {s.label}
                </p>
                <div className="mt-2 flex items-baseline justify-between">
                  <p className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
                    {s.value}
                  </p>
                  <span className="text-xs font-medium text-[var(--color-epc)]">
                    {s.delta}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--color-ink)]">
                Upcoming assignments
              </h2>
              <Link
                href="/dashboard/assignments"
                className="text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] inline-flex items-center gap-1"
              >
                View all
                <IconArrowRight size={14} />
              </Link>
            </div>

            <Card className="mt-4 overflow-hidden">
              <ul className="divide-y divide-[var(--color-border)]">
                {upcoming.map((a) => {
                  const meta = STATUS_META[a.status];
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/dashboard/assignments/${a.id}`}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-[var(--color-bg-alt)]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[var(--color-ink)] truncate">
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
                        <div className="text-right text-sm text-[var(--color-ink-soft)]">
                          <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                            Preferred
                          </p>
                          <p className="font-medium text-[var(--color-ink)]">{a.preferredDate}</p>
                        </div>
                        <Badge bg={meta.bg} fg={meta.fg}>
                          {meta.label}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Recent activity</h2>
            <Card className="mt-4">
              <ul className="divide-y divide-[var(--color-border)]">
                {RECENT_ACTIVITY.map((r, i) => (
                  <li key={i} className="flex items-start gap-3 p-4">
                    <span
                      className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-[var(--color-bg-muted)] text-[var(--color-ink-soft)] shrink-0"
                      aria-hidden
                    >
                      {r.kind === "delivered" ? (
                        <IconCheck size={14} />
                      ) : r.kind === "scheduled" ? (
                        <IconCalendar size={14} />
                      ) : (
                        <IconList size={14} />
                      )}
                    </span>
                    <div className="min-w-0 text-sm">
                      <p className="text-[var(--color-ink)]">
                        <span className="font-medium">{r.who}</span> {r.what}{" "}
                        <span className="font-medium">{r.ref}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{r.when}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </div>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Quick actions</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Card className="p-6">
              <p className="font-medium text-[var(--color-ink)]">Create an assignment</p>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                Start a new property inspection in under 2 minutes.
              </p>
              <Button href="/dashboard/assignments/new" size="sm" className="mt-4">
                Start now
              </Button>
            </Card>
            <Card className="p-6">
              <p className="font-medium text-[var(--color-ink)]">Invite a colleague</p>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                Add people to your team so they can manage assignments too.
              </p>
              <Button href="/dashboard/users" size="sm" variant="secondary" className="mt-4">
                Manage users
              </Button>
            </Card>
            <Card className="p-6">
              <p className="font-medium text-[var(--color-ink)]">This month&apos;s overview</p>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                See revenue, delivered inspections and commission breakdowns.
              </p>
              <Button href="/dashboard/overview" size="sm" variant="secondary" className="mt-4">
                Open overview
              </Button>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}
