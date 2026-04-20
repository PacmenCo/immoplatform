import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge, ServicePill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  IconArrowRight,
  IconCheck,
  IconList,
  IconCalendar,
} from "@/components/ui/Icons";
import { STATUS_META, Status } from "@/lib/mockData";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export default async function DashboardHome() {
  const session = await requireSession();

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [active, dueThisWeek, deliveredMtd, services, upcoming, recentAudits] =
    await Promise.all([
      prisma.assignment.count({
        where: { status: { in: ["scheduled", "in_progress"] } },
      }),
      prisma.assignment.count({
        where: {
          status: { in: ["scheduled", "in_progress"] },
          preferredDate: { gte: now, lte: weekFromNow },
        },
      }),
      prisma.assignment.count({
        where: { deliveredAt: { gte: monthStart } },
      }),
      prisma.service.findMany(),
      prisma.assignment.findMany({
        where: { status: { in: ["scheduled", "in_progress"] } },
        orderBy: { preferredDate: "asc" },
        take: 4,
        include: {
          services: true,
        },
      }),
      prisma.auditLog.findMany({
        orderBy: { at: "desc" },
        take: 5,
        include: { actor: true },
      }),
    ]);

  const servicesByKey = Object.fromEntries(services.map((s) => [s.key, s]));

  const stats = [
    {
      label: "Active assignments",
      value: active.toString(),
      delta: `${dueThisWeek} due this week`,
    },
    {
      label: "Delivered (MTD)",
      value: deliveredMtd.toString(),
      delta: `Since ${monthStart.toISOString().slice(0, 10)}`,
    },
    {
      label: "Team members",
      value: "", // filled below
      delta: "",
    },
    {
      label: "Avg. turnaround",
      value: "4.2 d",
      delta: "−0.3 d vs last month",
    },
  ];

  const memberCount = await prisma.user.count({ where: { deletedAt: null } });
  stats[2].value = memberCount.toString();
  stats[2].delta = "People on the platform";

  return (
    <>
      <Topbar title="Overview" subtitle={`Welcome back, ${session.user.firstName}`} />
      <div className="p-8 space-y-8 max-w-[1400px]">
        <section aria-labelledby="stats-title">
          <h2 id="stats-title" className="sr-only">
            Key metrics
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label} className="p-6">
                <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {s.label}
                </p>
                <div className="mt-2 flex items-baseline justify-between">
                  <p className="text-3xl font-semibold tracking-tight text-[var(--color-ink)] tabular-nums">
                    {s.value}
                  </p>
                  <span className="text-xs font-medium text-[var(--color-ink-muted)]">
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

            {upcoming.length === 0 ? (
              <Card className="mt-4 p-8 text-center text-sm text-[var(--color-ink-muted)]">
                Nothing on the calendar yet.
                <Button href="/dashboard/assignments/new" size="sm" className="ml-3">
                  Create an assignment
                </Button>
              </Card>
            ) : (
              <Card className="mt-4 overflow-hidden">
                <ul className="divide-y divide-[var(--color-border)]">
                  {upcoming.map((a) => {
                    const meta = STATUS_META[a.status as Status] ?? STATUS_META.draft;
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
                              {a.services.map((s) => {
                                const svc = servicesByKey[s.serviceKey];
                                return svc ? (
                                  <ServicePill
                                    key={s.serviceKey}
                                    color={svc.color}
                                    label={svc.short}
                                  />
                                ) : null;
                              })}
                            </div>
                          </div>
                          <div className="text-right text-sm text-[var(--color-ink-soft)]">
                            <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                              Preferred
                            </p>
                            <p className="font-medium text-[var(--color-ink)] tabular-nums">
                              {a.preferredDate?.toISOString().slice(0, 10) ?? "—"}
                            </p>
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
            )}
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">
              Recent activity
            </h2>
            <Card className="mt-4">
              {recentAudits.length === 0 ? (
                <div className="p-4 text-sm text-[var(--color-ink-muted)]">
                  Nothing yet — activity shows up once people start working.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {recentAudits.map((r) => {
                    const actor = r.actor
                      ? `${r.actor.firstName} ${r.actor.lastName}`
                      : "System";
                    const iconKind = r.verb.includes("delivered")
                      ? "done"
                      : r.verb.includes("scheduled") || r.verb.includes("created")
                        ? "schedule"
                        : "list";
                    return (
                      <li key={r.id} className="flex items-start gap-3 p-4">
                        <span
                          className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-[var(--color-bg-muted)] text-[var(--color-ink-soft)] shrink-0"
                          aria-hidden
                        >
                          {iconKind === "done" ? (
                            <IconCheck size={14} />
                          ) : iconKind === "schedule" ? (
                            <IconCalendar size={14} />
                          ) : (
                            <IconList size={14} />
                          )}
                        </span>
                        <div className="min-w-0 text-sm">
                          <p className="text-[var(--color-ink)]">
                            <span className="font-medium">{actor}</span>{" "}
                            <span className="text-[var(--color-ink-soft)]">
                              {r.verb.replace(/_/g, " ").replace(/\./g, " ")}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--color-ink-muted)] tabular-nums">
                            {r.at.toISOString().replace("T", " ").slice(0, 16)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
        </div>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">
              Quick actions
            </h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Card className="p-6">
              <p className="font-medium text-[var(--color-ink)]">
                Create an assignment
              </p>
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
              <Button
                href="/dashboard/users/invite"
                size="sm"
                variant="secondary"
                className="mt-4"
              >
                Invite user
              </Button>
            </Card>
            <Card className="p-6">
              <p className="font-medium text-[var(--color-ink)]">
                This month&apos;s overview
              </p>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                Revenue, delivered inspections, commission breakdowns.
              </p>
              <Button
                href="/dashboard/overview"
                size="sm"
                variant="secondary"
                className="mt-4"
              >
                Open overview
              </Button>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}
