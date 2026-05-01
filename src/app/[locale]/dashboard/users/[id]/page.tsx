import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { localeRedirect } from "@/i18n/navigation";
import type { Prisma } from "@prisma/client";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, ServicePill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  IconMail,
  IconPhone,
  IconMapPin,
  IconCalendar,
  IconBuilding,
  IconArrowRight,
} from "@/components/ui/Icons";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { buildCanEditAssignment, canAdminUsers, canViewUser } from "@/lib/permissions";
import { roleBadge } from "@/lib/roleColors";
import { isOnline } from "@/lib/userStatus";
import { avatarImageUrl } from "@/lib/avatar";
import { BE_DATE_FULL, initials } from "@/lib/format";
import { STATUS_META, type Status, type ServiceKey } from "@/lib/mockData";
import { DeleteUserButton } from "../DeleteUserButton";
import { LegalBillingDisplay, type LegalBillingData } from "@/components/dashboard/LegalBillingDisplay";

// PLACEHOLDER — populated demo so we can preview the populated UI before the
// `companyInfo` columns land on the User schema. Swap to `user.companyInfo`
// (or wherever they end up) once wired. Set to `null` to preview the empty
// state instead.
const MOCK_FREELANCER_BILLING: LegalBillingData = {
  entityType: "sole_trader",
  legalName: null,
  vatNumber: "BE0712345678",
  kboNumber: "0712345678",
  iban: "BE68539007547034",
  billingEmail: "billing@inspector.be",
  billingPhone: "+32 3 234 56 78",
  billingAddress: "Lange Nieuwstraat 12",
  billingPostal: "2000",
  billingCity: "Antwerpen",
  billingCountry: "Belgium",
};

type AuditRow = {
  at: Date;
  verb: string;
  objectType: string | null;
  objectId: string | null;
  metadata: Prisma.JsonValue;
};

type Translator = (key: string, vars?: Record<string, unknown>) => string;

export default async function UserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("dashboard.users.detail");
  const tRoles = await getTranslations("dashboard.users.roles");
  const tRelative = await getTranslations("dashboard.users.detail.relativeTime");
  const tVerbs = await getTranslations("dashboard.users.detail.verbs");
  const tStatuses = await getTranslations("dashboard.assignments.statuses");
  const tServices = await getTranslations("services");
  const session = await requireSession();
  const canEdit = await buildCanEditAssignment(session);
  const { id } = await params;

  // Single query for the user + everything we render: memberships (with team),
  // specialties (with service). Assignments + audits come from separate
  // queries below because their filters differ by role.
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      memberships: {
        orderBy: { joinedAt: "asc" },
        include: {
          team: { select: { id: true, name: true, city: true } },
        },
      },
      specialties: {
        include: {
          service: {
            select: {
              key: true,
              label: true,
              short: true,
              color: true,
              description: true,
            },
          },
        },
      },
    },
  });
  if (!user || user.deletedAt) notFound();

  // Platform parity (UserController.php:42-46): staff cannot open admins or
  // other staff; users may always open themselves.
  if (!canViewUser(session, { id: user.id, role: user.role })) {
    await localeRedirect("/no-access?section=users");
  }

  const rb = roleBadge(user.role);
  const roleLabel = tRoles(user.role as "admin" | "staff" | "realtor" | "freelancer");
  const fullName = `${user.firstName} ${user.lastName}`;
  const primaryTeam = user.memberships[0]?.team ?? null;
  const online = isOnline(user);
  const subtitleSecondary = primaryTeam?.name ?? t("subtitleNoTeam");
  const tRelativeFn: Translator = (key, vars) => tRelative(key as never, vars as never);
  const tVerbsFn: Translator = (key, vars) => tVerbs(key as never, vars as never);
  const formatRelative = (from: Date) => relativeTimeI18n(from, tRelativeFn);

  // Role-scoped "recent work" + stats. Admin/staff don't carry personal
  // assignments — those sections render the generic empty state below.
  // Mirror AssignmentsList.php:232 which scopes a freelancer's visible
  // work to their own assigned rows; we apply the same rule here when
  // viewing another user's detail.
  const recentWhere =
    user.role === "freelancer"
      ? { freelancerId: user.id }
      : user.role === "realtor"
        ? { createdById: user.id }
        : null;

  const [recentAssignments, totalAssignments, activeCount, completedCount, auditRows] =
    await Promise.all([
      recentWhere
        ? prisma.assignment.findMany({
            where: recentWhere,
            orderBy: [{ completedAt: "desc" }, { preferredDate: "desc" }, { createdAt: "desc" }],
            take: 6,
            include: { services: { select: { serviceKey: true } } },
          })
        : Promise.resolve([]),
      recentWhere
        ? prisma.assignment.count({ where: recentWhere })
        : Promise.resolve(0),
      recentWhere
        ? prisma.assignment.count({
            where: { ...recentWhere, status: { in: ["scheduled", "in_progress"] } },
          })
        : Promise.resolve(0),
      recentWhere
        ? prisma.assignment.count({
            where: { ...recentWhere, status: "completed" },
          })
        : Promise.resolve(0),
      prisma.auditLog.findMany({
        where: { actorId: user.id },
        orderBy: { at: "desc" },
        take: 6,
        select: {
          at: true,
          verb: true,
          objectType: true,
          objectId: true,
          metadata: true,
        },
      }),
    ]);

  // Cache services to decorate recent-work pills. Small catalog + strong
  // cache hit rate — one extra Prisma round-trip is cheap here.
  const services =
    recentAssignments.length > 0
      ? await prisma.service.findMany({ select: { key: true, short: true, color: true } })
      : [];
  const servicesByKey = Object.fromEntries(services.map((s) => [s.key, s]));

  const avatarSrc = avatarImageUrl(user);

  return (
    <>
      <Topbar
        title={fullName}
        subtitle={`${roleLabel} · ${subtitleSecondary}`}
      />

      <div className="p-8 max-w-[1200px]">
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          <Link href="/dashboard/users" className="hover:text-[var(--color-ink)]">
            {t("breadcrumbUsers")}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[var(--color-ink-soft)]">{fullName}</span>
        </nav>

        {/* Profile header card */}
        <Card className="mb-6 overflow-hidden">
          <div
            aria-hidden
            className="relative h-28"
            style={{
              background:
                "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-soft) 100%)",
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 40%, rgba(245,158,11,0.8) 0%, transparent 50%), radial-gradient(circle at 80% 60%, rgba(16,185,129,0.6) 0%, transparent 45%)",
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
          </div>
          <div className="relative px-6 pb-6">
            <div className="-mt-12 flex flex-wrap items-start justify-between gap-4">
              <Avatar
                initials={initials(user.firstName, user.lastName)}
                imageUrl={avatarSrc}
                alt={fullName}
                size="xl"
                color="#334155"
              />
              <div className="mt-14 flex flex-wrap items-center gap-2">
                <Button href={`mailto:${user.email}`} variant="secondary" size="sm">
                  <IconMail size={14} />
                  {t("actions.message")}
                </Button>
                {canAdminUsers(session) && (
                  <>
                    <Button
                      href={`/dashboard/users/${user.id}/edit`}
                      variant="secondary"
                      size="sm"
                    >
                      {t("actions.edit")}
                    </Button>
                    {user.id !== session.user.id && (
                      <DeleteUserButton
                        userId={user.id}
                        userName={fullName}
                        redirectTo="/dashboard/users"
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                  {fullName}
                </h1>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink-muted)]">
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (online ? "bg-[var(--color-epc)]" : "bg-[var(--color-ink-faint)]")
                    }
                  />
                  {online
                    ? t("online")
                    : user.lastSeenAt
                      ? t("lastSeen", { when: formatRelative(user.lastSeenAt) })
                      : t("neverSignedIn")}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-ink-soft)]">
                <Badge bg={rb.bg} fg={rb.fg}>{roleLabel}</Badge>
                {primaryTeam && (
                  <>
                    <span className="text-[var(--color-ink-faint)]">·</span>
                    <Link
                      href={`/dashboard/teams/${primaryTeam.id}`}
                      className="hover:text-[var(--color-ink)]"
                    >
                      {primaryTeam.name}
                    </Link>
                  </>
                )}
                {user.region && (
                  <>
                    <span className="text-[var(--color-ink-faint)]">·</span>
                    <span>{user.region}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-6 lg:col-span-2">
            {user.bio && (
              <Card>
                <CardHeader><CardTitle>{t("about")}</CardTitle></CardHeader>
                <CardBody>
                  <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">
                    {user.bio}
                  </p>
                </CardBody>
              </Card>
            )}

            {user.role === "freelancer" && user.specialties.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("certifications.title")}</CardTitle>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                    {t("certifications.description")}
                  </p>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {user.specialties.map((sp) => (
                      <SpecialtyCard
                        key={sp.service.key}
                        service={sp.service}
                        title={tServices(`${sp.service.key as ServiceKey}.title`)}
                        description={tServices(`${sp.service.key as ServiceKey}.dashboardDescription`)}
                      />
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {user.role === "freelancer" && (
              <LegalBillingDisplay
                data={MOCK_FREELANCER_BILLING}
                editHref={`/dashboard/users/${user.id}/edit`}
                canEdit={canAdminUsers(session)}
              />
            )}

            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>{t("recentWork.title")}</CardTitle>
                  {recentAssignments.length > 0 && (
                    <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                      {t("recentWork.showingOf", { shown: recentAssignments.length, total: totalAssignments })}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {recentAssignments.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
                    {user.role === "admin" || user.role === "staff"
                      ? t("recentWork.emptyAdminStaff")
                      : t("recentWork.emptyDefault")}
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {recentAssignments.map((a) => {
                      const meta = STATUS_META[a.status as Status] ?? STATUS_META.draft;
                      return (
                        <li key={a.id}>
                          <Link
                            href={`/dashboard/assignments/${a.id}${canEdit(a) ? "/edit" : ""}`}
                            className="group flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-[var(--color-ink-muted)]">
                                  {a.reference}
                                </span>
                                <Badge bg={meta.bg} fg={meta.fg} size="sm">
                                  {tStatuses(a.status as Status)}
                                </Badge>
                              </div>
                              <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
                                {a.address}, {a.city}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                {a.services.slice(0, 3).map((s) => {
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
                              <IconArrowRight
                                size={14}
                                className="text-[var(--color-ink-faint)] transition-transform group-hover:translate-x-0.5"
                              />
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("recentActivity.title")}</CardTitle></CardHeader>
              <CardBody className="space-y-4">
                {auditRows.length === 0 ? (
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    {t("recentActivity.empty")}
                  </p>
                ) : (
                  auditRows.map((row, i) => (
                    <ActivityItem
                      key={`${row.at.getTime()}-${i}`}
                      row={row}
                      tVerbs={tVerbsFn}
                      tRelative={tRelativeFn}
                    />
                  ))
                )}
              </CardBody>
            </Card>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader><CardTitle>{t("contact.title")}</CardTitle></CardHeader>
              <CardBody className="space-y-3 text-sm">
                <a
                  href={`mailto:${user.email}`}
                  className="flex items-center gap-3 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                >
                  <IconMail size={15} className="shrink-0 text-[var(--color-ink-muted)]" />
                  <span className="truncate">{user.email}</span>
                </a>
                {user.phone && (
                  <a
                    href={`tel:${user.phone}`}
                    className="flex items-center gap-3 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                  >
                    <IconPhone size={15} className="shrink-0 text-[var(--color-ink-muted)]" />
                    <span>{user.phone}</span>
                  </a>
                )}
                {user.region && (
                  <div className="flex items-center gap-3 text-[var(--color-ink-soft)]">
                    <IconMapPin size={15} className="shrink-0 text-[var(--color-ink-muted)]" />
                    <span>{user.region}</span>
                  </div>
                )}
                {primaryTeam && (
                  <div className="flex items-center gap-3 text-[var(--color-ink-soft)]">
                    <IconBuilding size={15} className="shrink-0 text-[var(--color-ink-muted)]" />
                    <Link
                      href={`/dashboard/teams/${primaryTeam.id}`}
                      className="hover:text-[var(--color-ink)]"
                    >
                      {primaryTeam.name}
                      {user.memberships.length > 1 && (
                        <span className="ml-1 text-xs text-[var(--color-ink-muted)]">
                          {t("contact.membershipsExtra", { count: user.memberships.length - 1 })}
                        </span>
                      )}
                    </Link>
                  </div>
                )}
                <div className="flex items-center gap-3 text-[var(--color-ink-soft)]">
                  <IconCalendar size={15} className="shrink-0 text-[var(--color-ink-muted)]" />
                  <span>{t("contact.joined", { date: BE_DATE_FULL.format(user.joinedAt) })}</span>
                </div>
              </CardBody>
            </Card>

            {(user.role === "freelancer" || user.role === "realtor") && (
              <Card>
                <CardHeader><CardTitle>{t("atAGlance.title")}</CardTitle></CardHeader>
                <CardBody className="grid grid-cols-2 gap-4">
                  <Stat label={t("atAGlance.active")} value={activeCount.toString()} />
                  <Stat
                    label={user.role === "freelancer" ? t("atAGlance.completed") : t("atAGlance.closed")}
                    value={completedCount.toString()}
                  />
                  {user.role === "freelancer" ? (
                    <Stat label={t("atAGlance.services")} value={user.specialties.length.toString()} />
                  ) : (
                    <Stat label={t("atAGlance.teams")} value={user.memberships.length.toString()} />
                  )}
                  <Stat label={t("atAGlance.total")} value={totalAssignments.toString()} />
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>{t("roleAccess.title")}</CardTitle></CardHeader>
              <CardBody className="space-y-2.5 text-sm">
                {user.role === "admin" && (
                  <>
                    <PermissionRow label={t("roleAccess.admin.fullAccess")} granted yesLabel={t("roleAccess.yes")} />
                    <PermissionRow label={t("roleAccess.admin.manageUsersTeams")} granted yesLabel={t("roleAccess.yes")} />
                    <PermissionRow label={t("roleAccess.admin.billingPriceLists")} granted yesLabel={t("roleAccess.yes")} />
                  </>
                )}
                {user.role === "staff" && (
                  <>
                    <PermissionRow label={t("roleAccess.staff.createAssign")} granted yesLabel={t("roleAccess.yes")} />
                    <PermissionRow label={t("roleAccess.staff.viewAllTeams")} granted yesLabel={t("roleAccess.yes")} />
                    <PermissionRow label={t("roleAccess.staff.supportConsole")} granted yesLabel={t("roleAccess.yes")} />
                  </>
                )}
                {user.role === "realtor" && (
                  <>
                    <PermissionRow label={t("roleAccess.realtor.createAssignments")} granted yesLabel={t("roleAccess.yes")} />
                    <PermissionRow label={t("roleAccess.realtor.seeTeamActivity")} granted yesLabel={t("roleAccess.yes")} />
                    <PermissionRow label={t("roleAccess.realtor.inviteTeammates")} granted yesLabel={t("roleAccess.yes")} />
                  </>
                )}
                {user.role === "freelancer" && (
                  <>
                    <PermissionRow label={t("roleAccess.freelancer.acceptAssignments")} granted yesLabel={t("roleAccess.yes")} />
                    <PermissionRow label={t("roleAccess.freelancer.uploadDeliverables")} granted yesLabel={t("roleAccess.yes")} />
                    <PermissionRow label={t("roleAccess.freelancer.setAvailability")} granted yesLabel={t("roleAccess.yes")} />
                  </>
                )}
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────

type ServiceLite = {
  key: string;
  label: string;
  short: string;
  color: string;
  description: string;
};

function SpecialtyCard({
  service,
  title,
  description,
}: {
  service: ServiceLite;
  title: string;
  description: string;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-[var(--radius-md)] border bg-[var(--color-bg)] p-3"
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: service.color,
        borderColor: "var(--color-border)",
      }}
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded text-[10px] font-bold tracking-wider text-white"
        style={{ backgroundColor: service.color }}
      >
        {service.short}
      </span>
      <div>
        <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{description}</p>
      </div>
    </div>
  );
}

/** Single audit-log entry in the activity feed. Verb → friendly label is
 *  resolved via the i18n catalog. Unknown verbs fall back to a de-dotted
 *  rendering. */
const VERB_KEYS: Record<string, string> = {
  "assignment.created": "assignmentCreated",
  "assignment.updated": "assignmentUpdated",
  "assignment.started": "assignmentStarted",
  "assignment.completed": "assignmentCompleted",
  "assignment.cancelled": "assignmentCancelled",
  "assignment.deleted": "assignmentDeleted",
  "assignment.reassigned": "assignmentReassigned",
  "assignment.file_uploaded": "assignmentFileUploaded",
  "assignment.file_deleted": "assignmentFileDeleted",
  "assignment.commission_applied": "assignmentCommissionApplied",
  "commission.quarter_paid": "commissionQuarterPaid",
  "commission.quarter_unpaid": "commissionQuarterUnpaid",
  "team.created": "teamCreated",
  "team.updated": "teamUpdated",
  "team.deleted": "teamDeleted",
  "team.member_added": "teamMemberAdded",
  "team.member_removed": "teamMemberRemoved",
  "team.ownership_transferred": "teamOwnershipTransferred",
  "user.created": "userCreated",
  "user.deleted": "userDeleted",
  "user.profile_updated": "userProfileUpdated",
  "user.password_changed": "userPasswordChanged",
  "user.email_changed": "userEmailChanged",
  "user.role_changed": "userRoleChanged",
  "user.signed_in": "userSignedIn",
  "user.signed_out": "userSignedOut",
  "invite.sent": "inviteSent",
  "invite.accepted": "inviteAccepted",
  "announcement.created": "announcementCreated",
  "revenue_adjustment.created": "revenueAdjustmentCreated",
  "calendar.connected": "calendarConnected",
  "calendar.disconnected": "calendarDisconnected",
};

function verbLabel(verb: string, tVerbs: Translator): string {
  const key = VERB_KEYS[verb];
  if (!key) return verb.replace(/\./g, " ");
  try {
    return tVerbs(key);
  } catch {
    return verb.replace(/\./g, " ");
  }
}

function ActivityItem({
  row,
  tVerbs,
  tRelative,
}: {
  row: AuditRow;
  tVerbs: Translator;
  tRelative: Translator;
}) {
  // Surface the reference / target when the metadata has one — turns
  // "Created an assignment" into "Created assignment ASG-2026-1004".
  // `metadata` is JSONB (already-parsed Prisma.JsonValue); accept either
  // an object (Postgres standard) or a JSON-encoded string (legacy rows).
  let suffix = "";
  const raw = row.metadata;
  let meta: { reference?: string; title?: string; name?: string } | null = null;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    meta = raw as { reference?: string; title?: string; name?: string };
  } else if (typeof raw === "string") {
    try {
      meta = JSON.parse(raw);
    } catch {
      meta = null;
    }
  }
  if (meta) {
    if (meta.reference) suffix = ` ${meta.reference}`;
    else if (meta.title) suffix = `: ${meta.title}`;
    else if (meta.name) suffix = `: ${meta.name}`;
  }
  return (
    <div className="flex gap-3">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-border-strong)]" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--color-ink)]">
          {verbLabel(row.verb, tVerbs)}
          {suffix}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
          {relativeTimeI18n(row.at, tRelative)}
        </p>
      </div>
    </div>
  );
}

function relativeTimeI18n(from: Date, t: Translator): string {
  const diffMs = Date.now() - from.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return t("justNow");
  const min = Math.floor(sec / 60);
  if (min < 60) return t("minutesAgo", { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("hoursAgo", { count: hr });
  const day = Math.floor(hr / 24);
  if (day < 30) return t("daysAgo", { count: day });
  const mon = Math.floor(day / 30);
  if (mon < 12) return t("monthsAgo", { count: mon });
  return t("yearsAgo", { count: Math.floor(mon / 12) });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight text-[var(--color-ink)] tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{label}</p>
    </div>
  );
}

function PermissionRow({
  label,
  granted,
  yesLabel,
}: {
  label: string;
  granted: boolean;
  yesLabel: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-ink-soft)]">{label}</span>
      {granted ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-epc)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {yesLabel}
        </span>
      ) : (
        <span className="text-xs text-[var(--color-ink-faint)]">—</span>
      )}
    </div>
  );
}
