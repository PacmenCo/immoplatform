import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, ServicePill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  IconMapPin,
  IconCalendar,
  IconArrowRight,
  IconCheck,
} from "@/components/ui/Icons";
import { ASSIGNMENTS, SERVICES, STATUS_META } from "@/lib/mockData";

const stats = [
  { label: "Today's jobs", value: "2", delta: "0 left" },
  { label: "This week", value: "9", delta: "+3 vs last week" },
  { label: "Pending uploads", value: "1", delta: "ASG-2026-1002" },
  { label: "Completed this month", value: "14", delta: "+2 vs March" },
];

const todaySchedule = [
  {
    time: "09:00 — 10:30",
    assignment: ASSIGNMENTS[0],
  },
  {
    time: "13:00 — 14:30",
    assignment: ASSIGNMENTS[5],
  },
];

const recentCompleted = ASSIGNMENTS.filter(
  (a) => a.status === "delivered" || a.status === "completed",
).slice(0, 3);

export default function FreelancerDashboard() {
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
                  Saturday, April 18
                </span>
                <span>· 2 appointments</span>
              </div>
              <Badge bg="#dcfce7" fg="#15803d">
                On track
              </Badge>
            </CardHeader>
            <ul className="divide-y divide-[var(--color-border)]">
              {todaySchedule.map((entry) => {
                const a = entry.assignment;
                return (
                  <li key={a.id}>
                    <Link
                      href={`/dashboard/assignments/${a.id}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-6 px-6 py-5 transition-colors hover:bg-[var(--color-bg-alt)]"
                    >
                      <div className="min-w-[120px]">
                        <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                          Time window
                        </p>
                        <p className="mt-1 font-semibold text-[var(--color-ink)]">
                          {entry.time}
                        </p>
                      </div>
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
                              {a.services.map((s) => (
                                <ServicePill
                                  key={s}
                                  color={SERVICES[s].color}
                                  label={SERVICES[s].short}
                                />
                              ))}
                              <span className="text-xs text-[var(--color-ink-muted)]">
                                {a.reference}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm">
                          Directions
                        </Button>
                        <IconArrowRight
                          size={16}
                          className="text-[var(--color-ink-muted)]"
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
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
          <div className="grid gap-4 md:grid-cols-3">
            {recentCompleted.map((a) => {
              const meta = STATUS_META[a.status];
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/assignments/${a.id}`}
                  className="block"
                >
                  <Card className="h-full p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
                    <div className="flex items-start justify-between gap-3">
                      <Badge bg={meta.bg} fg={meta.fg}>
                        {meta.label}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-epc)]">
                        <IconCheck size={12} /> Paid
                      </span>
                    </div>
                    <p className="mt-4 font-medium text-[var(--color-ink)]">
                      {a.address}
                    </p>
                    <p className="text-sm text-[var(--color-ink-soft)]">
                      {a.postal} {a.city}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {a.services.map((s) => (
                        <ServicePill
                          key={s}
                          color={SERVICES[s].color}
                          label={SERVICES[s].short}
                        />
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-ink-muted)]">
                      <span>{a.reference}</span>
                      <span>{a.preferredDate}</span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
