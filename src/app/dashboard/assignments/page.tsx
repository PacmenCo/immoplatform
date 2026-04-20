import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge, ServicePill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconFilter, IconList, IconPlus } from "@/components/ui/Icons";
import { STATUS_META, Status } from "@/lib/mockData";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assignmentScope, composeWhere, hasRole } from "@/lib/permissions";

const statusOrder: Status[] = ["draft", "scheduled", "in_progress", "delivered", "completed"];

function initials(first: string, last: string): string {
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "??";
}

export default async function AssignmentsList() {
  const session = await requireSession();
  const scope = await assignmentScope(session);
  const isFreelancer = hasRole(session, "freelancer");
  const isRealtor = hasRole(session, "realtor");

  const [assignments, services, counts] = await Promise.all([
    prisma.assignment.findMany({
      where: composeWhere(scope),
      orderBy: { preferredDate: "desc" },
      include: {
        team: { select: { id: true, name: true } },
        freelancer: { select: { id: true, firstName: true, lastName: true } },
        services: true,
      },
    }),
    prisma.service.findMany(),
    prisma.assignment.groupBy({
      by: ["status"],
      where: composeWhere(scope),
      _count: { _all: true },
    }),
  ]);

  const servicesByKey = Object.fromEntries(services.map((s) => [s.key, s]));
  const countByStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count._all]),
  );

  return (
    <>
      <Topbar title="Assignments" subtitle={`${assignments.length} total`} />

      <div className="p-8 space-y-6 max-w-[1400px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-ink)]">
              All
              <span className="rounded-full bg-[var(--color-bg-muted)] px-1.5 text-xs">
                {assignments.length}
              </span>
            </button>
            {statusOrder.map((s) => {
              const count = countByStatus[s] ?? 0;
              const meta = STATUS_META[s];
              return (
                <button
                  key={s}
                  className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-ink-soft)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.fg }} />
                  {meta.label}
                  <span className="text-xs text-[var(--color-ink-muted)]">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">
              <IconFilter size={14} />
              Filters
            </Button>
            <Button href="/dashboard/assignments/new" size="sm">
              <IconPlus size={14} />
              New
            </Button>
          </div>
        </div>

        {assignments.length === 0 ? (
          <EmptyState
            variant="dashed"
            icon={<IconList size={22} />}
            title={
              isFreelancer
                ? "No inspections assigned to you yet"
                : isRealtor
                  ? "No certificate orders yet for your team"
                  : "No assignments yet"
            }
            description={
              isFreelancer
                ? "Once a realtor assigns you to an inspection, it shows up here."
                : isRealtor
                  ? "Click New assignment to order your team's first certificate."
                  : "Create your first property inspection to get started."
            }
            action={
              !isFreelancer ? (
                <Button href="/dashboard/assignments/new" size="md">
                  <IconPlus size={14} />
                  Create assignment
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    <th className="text-left font-semibold px-6 py-3">Reference</th>
                    <th className="text-left font-semibold px-6 py-3">Property</th>
                    <th className="text-left font-semibold px-6 py-3">Services</th>
                    <th className="text-left font-semibold px-6 py-3">Team</th>
                    <th className="text-left font-semibold px-6 py-3">Freelancer</th>
                    <th className="text-left font-semibold px-6 py-3">Preferred date</th>
                    <th className="text-left font-semibold px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {assignments.map((a) => {
                    const meta = STATUS_META[a.status as Status] ?? STATUS_META.draft;
                    const visibleServices = a.services.slice(0, 3);
                    const extraServices = a.services.length - visibleServices.length;
                    return (
                      <tr
                        key={a.id}
                        className="group transition-colors hover:bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
                      >
                        <td className="px-6 py-3 whitespace-nowrap">
                          <Link
                            href={`/dashboard/assignments/${a.id}`}
                            className="font-mono text-xs font-medium text-[var(--color-ink)] hover:underline"
                          >
                            {a.reference}
                          </Link>
                        </td>
                        <td className="px-6 py-3">
                          <p className="text-sm font-medium text-[var(--color-ink)] leading-tight">
                            {a.address}
                          </p>
                          <p className="text-xs text-[var(--color-ink-muted)]">
                            {a.postal} {a.city}
                          </p>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-nowrap items-center gap-1">
                            {visibleServices.map((s) => {
                              const svc = servicesByKey[s.serviceKey];
                              return svc ? (
                                <ServicePill key={s.serviceKey} color={svc.color} label={svc.short} />
                              ) : null;
                            })}
                            {extraServices > 0 && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-ink-muted)] bg-[var(--color-bg-muted)]">
                                +{extraServices}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-[var(--color-ink-soft)]">
                          {a.team?.name ?? "—"}
                        </td>
                        <td className="px-6 py-3">
                          {a.freelancer ? (
                            <Link
                              href={`/dashboard/users/${a.freelancer.id}`}
                              className="inline-flex items-center gap-2 hover:[&>span:last-child]:text-[var(--color-ink)] hover:[&>span:last-child]:underline"
                            >
                              <Avatar
                                initials={initials(a.freelancer.firstName, a.freelancer.lastName)}
                                size="xs"
                              />
                              <span className="text-sm text-[var(--color-ink-soft)] whitespace-nowrap">
                                {a.freelancer.firstName} {a.freelancer.lastName}
                              </span>
                            </Link>
                          ) : (
                            <span className="text-xs italic text-[var(--color-ink-faint)]">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-[var(--color-ink-soft)] tabular-nums">
                          {a.preferredDate?.toISOString().slice(0, 10) ?? "—"}
                        </td>
                        <td className="px-6 py-3">
                          <Badge bg={meta.bg} fg={meta.fg}>
                            {meta.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
