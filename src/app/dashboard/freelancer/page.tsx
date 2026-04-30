import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, ServicePill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconMapPin,
  IconCalendar,
  IconArrowRight,
  IconCheck,
  IconList,
} from "@/components/ui/Icons";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { buildCanEditAssignment } from "@/lib/permissions";
import { STATUS_META, type Status } from "@/lib/mockData";
import { BE_DATE_FULL, BE_DATE_SHORT } from "@/lib/format";
import { dayRange, weekRange, monthRange } from "@/lib/period";

export default async function FreelancerDashboard() {
  const session = await requireSession();
  const canEdit = await buildCanEditAssignment(session);
  const now = new Date();
  const today = dayRange(now);
  const week = weekRange(now);
  const month = monthRange(now);

  // Scope every query on this page to the signed-in freelancer's own rows.
  const scope = { freelancerId: session.user.id };

  const [
    todaysJobs,
    thisWeekCount,
    inProgressCount,
    completedThisMonth,
    todaySchedule,
    recent,
    services,
  ] = await Promise.all([
    prisma.assignment.count({
      where: {
        ...scope,
        status: { in: ["scheduled", "in_progress"] },
        preferredDate: { gte: today.gte, lt: today.lt },
      },
    }),
    prisma.assignment.count({
      where: {
        ...scope,
        status: { in: ["scheduled", "in_progress"] },
        preferredDate: { gte: week.gte, lt: week.lt },
      },
    }),
    prisma.assignment.count({
      where: { ...scope, status: "in_progress" },
    }),
    prisma.assignment.count({
      where: {
        ...scope,
        status: "completed",
        completedAt: { gte: month.gte, lt: month.lt },
      },
    }),
    prisma.assignment.findMany({
      where: {
        ...scope,
        status: { in: ["scheduled", "in_progress"] },
        preferredDate: { gte: today.gte, lt: today.lt },
      },
      orderBy: { preferredDate: "asc" },
      include: { services: true },
    }),
    prisma.assignment.findMany({
      where: {
        ...scope,
        status: { in: ["delivered", "completed"] },
      },
      orderBy: [{ completedAt: "desc" }, { deliveredAt: "desc" }],
      take: 3,
      include: { services: true },
    }),
    prisma.service.findMany(),
  ]);

  const servicesByKey = Object.fromEntries(services.map((s) => [s.key, s]));

  const stats = [
    { label: "Today's jobs", value: String(todaysJobs) },
    { label: "This week", value: String(thisWeekCount) },
    // "In progress" = inspections the freelancer has started but not yet
    // delivered. Previously labelled "Pending uploads" but the query was on
    // status=in_progress (not "delivered awaiting files"); aligning copy to
    // the actual semantics.
    { label: "In progress", value: String(inProgressCount) },
    { label: "Completed this month", value: String(completedThisMonth) },
  ];

  return (
    <>
      <Topbar title="Freelancer" subtitle="Your day, your jobs, your uploads" />

      <div className="p-8 space-y-8 max-w-[1200px]">
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
                <div className="mt-2">
                  <p className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
                    {s.value}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">
              Today&apos;s schedule
            </h2>
            <Link
              href="/dashboard/calendar"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            >
              Open calendar
              <IconArrowRight size={14} />
            </Link>
          </div>
          <Card className="overflow-hidden">
            <CardHeader className="flex items-center justify-between bg-[var(--color-bg-alt)]">
              <div className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
                <IconCalendar size={16} />
                <span className="font-medium text-[var(--color-ink)]">
                  {BE_DATE_FULL.format(now)}
                </span>
                <span>
                  · {todaySchedule.length} appointment{todaySchedule.length === 1 ? "" : "s"}
                </span>
              </div>
              {todaySchedule.length > 0 && (
                <Badge bg="#dcfce7" fg="#15803d">
                  On track
                </Badge>
              )}
            </CardHeader>
            {todaySchedule.length === 0 ? (
              <EmptyState
                variant="bare"
                icon={<IconCalendar size={22} />}
                title="No inspections booked for today"
                description="Enjoy the breather. Upcoming inspections show here as soon as they're scheduled."
              />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {todaySchedule.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/dashboard/assignments/${a.id}${canEdit(a) ? "/edit" : ""}`}
                      className="grid grid-cols-[1fr_auto] items-center gap-6 px-6 py-5 transition-colors hover:bg-[var(--color-bg-alt)]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <IconMapPin
                            size={18}
                            className="mt-0.5 shrink-0 text-[var(--color-brand)]"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--color-ink)]">
                              {a.address}
                            </p>
                            <p className="text-sm text-[var(--color-ink-soft)]">
                              {a.postal} {a.city}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {a.services.map((link) => {
                                const svc = servicesByKey[link.serviceKey];
                                return svc ? (
                                  <ServicePill
                                    key={link.serviceKey}
                                    color={svc.color}
                                    label={svc.short}
                                  />
                                ) : null;
                              })}
                              <span className="text-xs text-[var(--color-ink-muted)]">
                                {a.reference}
                              </span>
                            </div>
                          </div>
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
            )}
          </Card>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">
              Recent completed
            </h2>
            <Link
              href="/dashboard/assignments"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            >
              View all
              <IconArrowRight size={14} />
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              variant="dashed"
              icon={<IconList size={22} />}
              title="Nothing delivered yet"
              description="Assignments you mark delivered or completed show here so you can jump back to them for follow-up."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {recent.map((a) => {
                const meta = STATUS_META[a.status as Status] ?? STATUS_META.draft;
                const when = a.completedAt ?? a.deliveredAt ?? a.preferredDate ?? null;
                return (
                  <Link
                    key={a.id}
                    href={`/dashboard/assignments/${a.id}${canEdit(a) ? "/edit" : ""}`}
                    className="block"
                  >
                    <Card className="h-full p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
                      <div className="flex items-start justify-between gap-3">
                        <Badge bg={meta.bg} fg={meta.fg}>
                          {meta.label}
                        </Badge>
                        {a.status === "completed" && (
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-epc)]">
                            <IconCheck size={12} /> Signed off
                          </span>
                        )}
                      </div>
                      <p className="mt-4 font-medium text-[var(--color-ink)]">
                        {a.address}
                      </p>
                      <p className="text-sm text-[var(--color-ink-soft)]">
                        {a.postal} {a.city}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {a.services.map((link) => {
                          const svc = servicesByKey[link.serviceKey];
                          return svc ? (
                            <ServicePill
                              key={link.serviceKey}
                              color={svc.color}
                              label={svc.short}
                            />
                          ) : null;
                        })}
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-ink-muted)]">
                        <span>{a.reference}</span>
                        <span>{when ? BE_DATE_SHORT.format(when) : "—"}</span>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
