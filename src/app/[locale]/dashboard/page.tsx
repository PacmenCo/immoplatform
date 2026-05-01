import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
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
import {
  assignmentScope,
  buildCanEditAssignment,
  canCreateAssignment,
  composeWhere,
  gateRealtorRequiresTeam,
  hasRole,
  role,
  userScope,
  type Role,
} from "@/lib/permissions";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
import { loadActiveAnnouncements } from "@/lib/announcements";
import { verbLabel } from "@/lib/audit-verbs";

const UPCOMING_KEY: Record<Role, "Admin" | "Staff" | "Realtor" | "Freelancer"> = {
  admin: "Admin",
  staff: "Staff",
  realtor: "Realtor",
  freelancer: "Freelancer",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.pageTitles");
  return { title: t("dashboard") };
}

export default async function DashboardHome() {
  const session = await requireSession();
  await gateRealtorRequiresTeam(session);
  const tStatuses = await getTranslations("dashboard.assignments.statuses");
  const t = await getTranslations("dashboard.home");
  const tVerbs = await getTranslations("dashboard.users.detail.verbs");

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const scope = await assignmentScope(session);
  const r = role(session);
  const canCreate = canCreateAssignment(session);
  // v1 parity: invite is admin + realtor only — staff is excluded.
  const canInvite = hasRole(session, "admin", "realtor");
  const isFreelancer = hasRole(session, "freelancer");
  const canEdit = await buildCanEditAssignment(session);

  // Privacy: admin/staff see the global feed; others see only their own
  // actions so realtors + freelancers can't spy on each other's activity.
  const auditWhere = hasRole(session, "admin", "staff")
    ? undefined
    : { actorId: session.user.id };

  const uScope = isFreelancer ? undefined : await userScope(session);

  const [
    active,
    dueThisWeek,
    deliveredMtd,
    services,
    upcoming,
    recentAudits,
    memberCount,
    announcements,
  ] = await Promise.all([
      prisma.assignment.count({
        where: composeWhere(
          { status: { in: ["scheduled", "in_progress"] } },
          scope,
        ),
      }),
      prisma.assignment.count({
        where: composeWhere(
          {
            status: { in: ["scheduled", "in_progress"] },
            preferredDate: { gte: now, lte: weekFromNow },
          },
          scope,
        ),
      }),
      prisma.assignment.count({
        where: composeWhere({ deliveredAt: { gte: monthStart } }, scope),
      }),
      prisma.service.findMany(),
      prisma.assignment.findMany({
        where: composeWhere(
          { status: { in: ["scheduled", "in_progress"] } },
          scope,
        ),
        orderBy: { preferredDate: "asc" },
        take: 4,
        include: {
          services: { select: { serviceKey: true } },
        },
      }),
      prisma.auditLog.findMany({
        where: auditWhere,
        orderBy: { at: "desc" },
        take: 5,
        include: { actor: { select: { firstName: true, lastName: true } } },
      }),
      isFreelancer
        ? Promise.resolve(0)
        : prisma.user.count({
            where: composeWhere({ deletedAt: null }, uScope),
          }),
      loadActiveAnnouncements(session.user.id),
    ]);

  const servicesByKey = Object.fromEntries(services.map((s) => [s.key, s]));

  const stats = [
    {
      label: t("stats.active"),
      value: active.toString(),
      delta: t("stats.activeDelta", { count: dueThisWeek }),
    },
    {
      label: t("stats.deliveredMtd"),
      value: deliveredMtd.toString(),
      delta: t("stats.deliveredMtdDelta", { date: monthStart.toISOString().slice(0, 10) }),
    },
    ...(isFreelancer
      ? []
      : [{
          label: t("stats.members"),
          value: memberCount.toString(),
          delta: r === "admin" || r === "staff" ? t("stats.membersDeltaPlatform") : t("stats.membersDeltaTeam"),
        }]),
    {
      label: t("stats.turnaround"),
      value: t("stats.turnaroundValue"),
      delta: t("stats.turnaroundDelta"),
    },
  ];

  return (
    <>
      <Topbar title={t("topbarTitle")} subtitle={t("topbarSubtitle", { firstName: session.user.firstName })} />
      <div className="p-8 space-y-8 max-w-[1400px]">
        <AnnouncementBanner items={announcements} />

        <section aria-labelledby="stats-title">
          <h2 id="stats-title" className="sr-only">
            {t("keyMetricsAria")}
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
                {t(`upcoming.heading${UPCOMING_KEY[r]}`)}
              </h2>
              <Link
                href="/dashboard/assignments"
                className="text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] inline-flex items-center gap-1"
              >
                {t(`upcoming.link${UPCOMING_KEY[r]}`)}
                <IconArrowRight size={14} />
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <Card className="mt-4 p-8 text-center text-sm text-[var(--color-ink-muted)]">
                {t("upcoming.empty")}
                {canCreate && (
                  <Button href="/dashboard/assignments/new" size="sm" className="ml-3">
                    {t("upcoming.createCta")}
                  </Button>
                )}
              </Card>
            ) : (
              <Card className="mt-4 overflow-hidden">
                <ul className="divide-y divide-[var(--color-border)]">
                  {upcoming.map((a) => {
                    const meta = STATUS_META[a.status as Status] ?? STATUS_META.draft;
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/dashboard/assignments/${a.id}${canEdit(a) ? "/edit" : ""}`}
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
                              {t("upcoming.preferredLabel")}
                            </p>
                            <p className="font-medium text-[var(--color-ink)] tabular-nums">
                              {a.preferredDate?.toISOString().slice(0, 10) ?? "—"}
                            </p>
                          </div>
                          <Badge bg={meta.bg} fg={meta.fg}>
                            {tStatuses(a.status as Status)}
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
              {t("recentActivity.heading")}
            </h2>
            <Card className="mt-4">
              {recentAudits.length === 0 ? (
                <div className="p-4 text-sm text-[var(--color-ink-muted)]">
                  {t("recentActivity.empty")}
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {recentAudits.map((r) => {
                    const actor = r.actor
                      ? `${r.actor.firstName} ${r.actor.lastName}`
                      : t("recentActivity.systemActor");
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
                              {verbLabel(r.verb, (k) => tVerbs(k as never))}
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

        {canCreate && (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--color-ink)]">
                {t("quickActions.heading")}
              </h2>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Card className="p-6">
                <p className="font-medium text-[var(--color-ink)]">
                  {t("quickActions.create.title")}
                </p>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                  {t("quickActions.create.body")}
                </p>
                <Button href="/dashboard/assignments/new" size="sm" className="mt-4">
                  {t("quickActions.create.cta")}
                </Button>
              </Card>
              {canInvite && (
                <Card className="p-6">
                  <p className="font-medium text-[var(--color-ink)]">{t("quickActions.invite.title")}</p>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                    {t("quickActions.invite.body")}
                  </p>
                  <Button
                    href="/dashboard/users/invite"
                    size="sm"
                    variant="secondary"
                    className="mt-4"
                  >
                    {t("quickActions.invite.cta")}
                  </Button>
                </Card>
              )}
              <Card className="p-6">
                <p className="font-medium text-[var(--color-ink)]">
                  {t("quickActions.overview.title")}
                </p>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                  {t("quickActions.overview.body")}
                </p>
                <Button
                  href="/dashboard/overview"
                  size="sm"
                  variant="secondary"
                  className="mt-4"
                >
                  {t("quickActions.overview.cta")}
                </Button>
              </Card>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
