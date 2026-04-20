import Link from "next/link";
import { notFound } from "next/navigation";
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
import {
  USERS,
  ASSIGNMENTS,
  SERVICES,
  STATUS_META,
  ServiceKey,
  UserRole,
} from "@/lib/mockData";

import { roleBadge } from "@/lib/roleColors";

export default async function UserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = USERS.find((u) => u.id === id);
  if (!user) notFound();

  const rb = roleBadge(user.role);

  const userAssignments = ASSIGNMENTS.filter((a) => {
    if (user.role === "freelancer") return a.freelancer?.avatar === user.avatar;
    if (user.role === "realtor") return a.team === user.team;
    return false;
  });

  const delivered = userAssignments.filter(
    (a) => a.status === "delivered" || a.status === "completed",
  ).length;
  const active = userAssignments.filter(
    (a) => a.status === "in_progress" || a.status === "scheduled",
  ).length;

  return (
    <>
      <Topbar title={user.name} subtitle={`${rb.label} · ${user.team === "—" ? "No team" : user.team}`} />

      <div className="p-8 max-w-[1200px]">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          <Link href="/dashboard/users" className="hover:text-[var(--color-ink)]">
            Users
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[var(--color-ink-soft)]">{user.name}</span>
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
            {/* Avatar overlaps into the banner */}
            <div className="-mt-12 flex items-start justify-between gap-4">
              <Avatar
                initials={user.avatar}
                size="xl"
                color="#0f172a"
              />
              <div className="mt-14 flex items-center gap-2">
                <Button href={`mailto:${user.email}`} variant="secondary" size="sm">
                  <IconMail size={14} />
                  Message
                </Button>
                <Button variant="ghost" size="sm">
                  Edit
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                  {user.name}
                </h1>
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink-muted)]"
                >
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (user.online
                        ? "bg-[var(--color-epc)]"
                        : "bg-[var(--color-ink-faint)]")
                    }
                  />
                  {user.online ? "Online now" : "Offline"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-ink-soft)]">
                <Badge bg={rb.bg} fg={rb.fg}>
                  {rb.label}
                </Badge>
                {user.team !== "—" && (
                  <>
                    <span className="text-[var(--color-ink-faint)]">·</span>
                    <span>{user.team}</span>
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
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardBody>
                  <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">
                    {user.bio}
                  </p>
                </CardBody>
              </Card>
            )}

            {/* Role-specific: freelancer specialties */}
            {user.role === "freelancer" && user.specialties && user.specialties.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Certifications</CardTitle>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                    Services this inspector is certified to perform.
                  </p>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {user.specialties.map((key) => (
                      <SpecialtyCard key={key} serviceKey={key} />
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Recent assignments */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent work</CardTitle>
                  {userAssignments.length > 0 && (
                    <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                      Showing last {Math.min(userAssignments.length, 6)} of {userAssignments.length}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {userAssignments.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
                    {user.role === "admin" || user.role === "staff"
                      ? "Admin & staff accounts don't carry assignments directly."
                      : "No assignments linked to this user yet."}
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {userAssignments.slice(0, 6).map((a) => {
                      const meta = STATUS_META[a.status];
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
                                {a.services.slice(0, 3).map((s) => (
                                  <ServicePill
                                    key={s}
                                    color={SERVICES[s].color}
                                    label={SERVICES[s].short}
                                  />
                                ))}
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

            {/* Activity timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <ActivityItem
                  when="2 hr ago"
                  text={
                    user.role === "freelancer"
                      ? "Delivered certificate for ASG-2026-1003"
                      : "Created assignment ASG-2026-1007"
                  }
                />
                <ActivityItem
                  when="yesterday"
                  text="Uploaded 3 files to ASG-2026-1004"
                />
                <ActivityItem when="2 days ago" text="Signed in from Brussels" />
                <ActivityItem when="1 week ago" text="Profile updated" />
              </CardBody>
            </Card>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
              </CardHeader>
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
                {user.team !== "—" && (
                  <div className="flex items-center gap-3 text-[var(--color-ink-soft)]">
                    <IconBuilding size={15} className="shrink-0 text-[var(--color-ink-muted)]" />
                    <Link href="/dashboard/teams" className="hover:text-[var(--color-ink)]">
                      {user.team}
                    </Link>
                  </div>
                )}
                <div className="flex items-center gap-3 text-[var(--color-ink-soft)]">
                  <IconCalendar size={15} className="shrink-0 text-[var(--color-ink-muted)]" />
                  <span>Joined {user.joined}</span>
                </div>
              </CardBody>
            </Card>

            {(user.role === "freelancer" || user.role === "realtor") && (
              <Card>
                <CardHeader>
                  <CardTitle>At a glance</CardTitle>
                </CardHeader>
                <CardBody className="grid grid-cols-2 gap-4">
                  <Stat label="Active" value={active.toString()} />
                  <Stat
                    label={user.role === "freelancer" ? "Delivered" : "Closed"}
                    value={delivered.toString()}
                  />
                  {user.role === "freelancer" ? (
                    <Stat
                      label="Services"
                      value={(user.specialties?.length ?? 0).toString()}
                    />
                  ) : (
                    <Stat label="Team size" value="12" />
                  )}
                  <Stat label="Total" value={`${userAssignments.length}`} />
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Role & access</CardTitle>
              </CardHeader>
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

function SpecialtyCard({ serviceKey }: { serviceKey: ServiceKey }) {
  const svc = SERVICES[serviceKey];
  return (
    <div
      className="flex items-start gap-3 rounded-[var(--radius-md)] border bg-[var(--color-bg)] p-3"
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: svc.color,
        borderColor: "var(--color-border)",
      }}
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded text-[10px] font-bold tracking-wider text-white"
        style={{ backgroundColor: svc.color }}
      >
        {svc.short}
      </span>
      <div>
        <p className="text-sm font-medium text-[var(--color-ink)]">{svc.label}</p>
        <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
          {svc.description}
        </p>
      </div>
    </div>
  );
}

function ActivityItem({ when, text }: { when: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-border-strong)]" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--color-ink)]">{text}</p>
        <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{when}</p>
      </div>
    </div>
  );
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
