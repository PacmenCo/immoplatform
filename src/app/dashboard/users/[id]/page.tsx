import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { canAdminUsers, canViewUser } from "@/lib/permissions";
import { roleBadge } from "@/lib/roleColors";
import { isOnline } from "@/lib/userStatus";
import { avatarImageUrl } from "@/lib/avatar";
import { BE_DATE_FULL, initials } from "@/lib/format";
import { STATUS_META, type Status } from "@/lib/mockData";
import { DeleteUserButton } from "../DeleteUserButton";

type AuditRow = {
  at: Date;
  verb: string;
  objectType: string | null;
  objectId: string | null;
  metadata: Prisma.JsonValue;
};

export default async function UserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
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
    redirect("/no-access?section=users");
  }

  const rb = roleBadge(user.role);
  const fullName = `${user.firstName} ${user.lastName}`;
  const primaryTeam = user.memberships[0]?.team ?? null;
  const online = isOnline(user);

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

  const [recentAssignments, totalAssignments, activeCount, deliveredCount, auditRows] =
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
            where: { ...recentWhere, status: { in: ["delivered", "completed"] } },
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
        subtitle={`${rb.label} · ${primaryTeam?.name ?? "No team"}`}
      />

      <div className="p-8 max-w-[1200px]">
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          <Link href="/dashboard/users" className="hover:text-[var(--color-ink)]">
            Users
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
            <div className="-mt-12 flex items-start justify-between gap-4">
              <Avatar
                initials={initials(user.firstName, user.lastName)}
                imageUrl={avatarSrc}
                alt={fullName}
                size="xl"
                color="#334155"
              />
              <div className="mt-14 flex items-center gap-2">
                <Button href={`mailto:${user.email}`} variant="secondary" size="sm">
                  <IconMail size={14} />
                  Message
                </Button>
                {canAdminUsers(session) && (
                  <>
                    <Button
                      href={`/dashboard/users/${user.id}/edit`}
                      variant="secondary"
                      size="sm"
                    >
                      Edit
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
                  {online ? "Online now" : user.lastSeenAt ? `Last seen ${relativeTime(user.lastSeenAt)}` : "Never signed in"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-ink-soft)]">
                <Badge bg={rb.bg} fg={rb.fg}>{rb.label}</Badge>
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
                <CardHeader><CardTitle>About</CardTitle></CardHeader>
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
                  <CardTitle>Certifications</CardTitle>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                    Services this inspector is certified to perform.
                  </p>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {user.specialties.map((sp) => (
                      <SpecialtyCard
                        key={sp.service.key}
                        service={sp.service}
                      />
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent work</CardTitle>
                  {recentAssignments.length > 0 && (
                    <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                      Showing last {recentAssignments.length} of {totalAssignments}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {recentAssignments.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
                    {user.role === "admin" || user.role === "staff"
                      ? "Admin & staff accounts don't carry assignments directly."
                      : "No assignments linked to this user yet."}
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {recentAssignments.map((a) => {
                      const meta = STATUS_META[a.status as Status] ?? STATUS_META.draft;
                      return (
                        <li key={a.id}>
                          <Link
                            href={`/dashboard/assignments/${a.id}`}
                            className="group flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-[var(--color-ink-muted)]">
                                  {a.reference}
                                </span>
                                <Badge bg={meta.bg} fg={meta.fg} size="sm">
                                  {meta.label}
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
              <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
              <CardBody className="space-y-4">
                {auditRows.length === 0 ? (
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    No recent activity.
                  </p>
                ) : (
                  auditRows.map((row, i) => (
                    <ActivityItem key={`${row.at.getTime()}-${i}`} row={row} />
                  ))
                )}
              </CardBody>
            </Card>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
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
                          +{user.memberships.length - 1} more
                        </span>
                      )}
                    </Link>
                  </div>
                )}
                <div className="flex items-center gap-3 text-[var(--color-ink-soft)]">
                  <IconCalendar size={15} className="shrink-0 text-[var(--color-ink-muted)]" />
                  <span>Joined {BE_DATE_FULL.format(user.joinedAt)}</span>
                </div>
              </CardBody>
            </Card>

            {(user.role === "freelancer" || user.role === "realtor") && (
              <Card>
                <CardHeader><CardTitle>At a glance</CardTitle></CardHeader>
                <CardBody className="grid grid-cols-2 gap-4">
                  <Stat label="Active" value={activeCount.toString()} />
                  <Stat
                    label={user.role === "freelancer" ? "Delivered" : "Closed"}
                    value={deliveredCount.toString()}
                  />
                  {user.role === "freelancer" ? (
                    <Stat label="Services" value={user.specialties.length.toString()} />
                  ) : (
                    <Stat label="Teams" value={user.memberships.length.toString()} />
                  )}
                  <Stat label="Total" value={totalAssignments.toString()} />
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>Role & access</CardTitle></CardHeader>
              <CardBody className="space-y-2.5 text-sm">
                {user.role === "admin" && (
                  <>
                    <PermissionRow label="Full platform access" granted />
                    <PermissionRow label="Manage users & teams" granted />
                    <PermissionRow label="Billing & price lists" granted />
                  </>
                )}
                {user.role === "staff" && (
                  <>
                    <PermissionRow label="Create & assign work" granted />
                    <PermissionRow label="View all teams" granted />
                    <PermissionRow label="Support console" granted />
                  </>
                )}
                {user.role === "realtor" && (
                  <>
                    <PermissionRow label="Create assignments" granted />
                    <PermissionRow label="See team activity" granted />
                    <PermissionRow label="Invite teammates" granted />
                  </>
                )}
                {user.role === "freelancer" && (
                  <>
                    <PermissionRow label="Accept assignments" granted />
                    <PermissionRow label="Upload deliverables" granted />
                    <PermissionRow label="Set availability" granted />
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

function SpecialtyCard({ service }: { service: ServiceLite }) {
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
        <p className="text-sm font-medium text-[var(--color-ink)]">{service.label}</p>
        <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{service.description}</p>
      </div>
    </div>
  );
}

/** Single audit-log entry in the activity feed. Verb → friendly label via a
 *  small map; unknown verbs fall back to a de-dotted rendering. */
const VERB_LABELS: Record<string, string> = {
  "assignment.created": "Created an assignment",
  "assignment.updated": "Updated an assignment",
  "assignment.started": "Started an inspection",
  "assignment.delivered": "Delivered an inspection",
  "assignment.completed": "Signed off on an assignment",
  "assignment.cancelled": "Cancelled an assignment",
  "assignment.deleted": "Deleted an assignment",
  "assignment.reassigned": "Reassigned an inspector",
  "assignment.file_uploaded": "Uploaded files",
  "assignment.file_deleted": "Removed a file",
  "assignment.commission_applied": "Commission recorded",
  "commission.quarter_paid": "Marked a quarter paid",
  "commission.quarter_unpaid": "Reopened a quarter",
  "team.created": "Created a team",
  "team.updated": "Updated a team",
  "team.deleted": "Deleted a team",
  "team.member_added": "Added a team member",
  "team.member_removed": "Removed a team member",
  "team.ownership_transferred": "Transferred ownership",
  "user.created": "Created a user",
  "user.deleted": "Deleted a user",
  "user.profile_updated": "Updated profile",
  "user.password_changed": "Changed password",
  "user.email_changed": "Changed email",
  "user.role_changed": "Changed role",
  "user.signed_in": "Signed in",
  "user.signed_out": "Signed out",
  "invite.sent": "Sent an invite",
  "invite.accepted": "Invite accepted",
  "announcement.created": "Published an announcement",
  "revenue_adjustment.created": "Added a revenue adjustment",
  "calendar.connected": "Connected a calendar",
  "calendar.disconnected": "Disconnected a calendar",
};

function verbLabel(verb: string): string {
  return VERB_LABELS[verb] ?? verb.replace(/\./g, " ");
}

function ActivityItem({ row }: { row: AuditRow }) {
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
          {verbLabel(row.verb)}
          {suffix}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
          {relativeTime(row.at)}
        </p>
      </div>
    </div>
  );
}

function relativeTime(from: Date): string {
  const diffMs = Date.now() - from.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon}mo ago`;
  return `${Math.floor(mon / 12)}y ago`;
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

function PermissionRow({ label, granted }: { label: string; granted: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-ink-soft)]">{label}</span>
      {granted ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-epc)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Yes
        </span>
      ) : (
        <span className="text-xs text-[var(--color-ink-faint)]">—</span>
      )}
    </div>
  );
}
