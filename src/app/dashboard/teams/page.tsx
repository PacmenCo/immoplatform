import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ServicePill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconPlus,
  IconBuilding,
  IconUsers,
  IconList,
  IconMapPin,
  IconArrowRight,
  IconShield,
} from "@/components/ui/Icons";
import { prisma } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/auth";
import {
  canCreateFirstTeam,
  composeWhere,
  getUserTeamIds,
  hasRole,
  teamScope,
} from "@/lib/permissions";
import { initials } from "@/lib/format";

export const metadata = { title: "Teams" };

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ needs_team?: string }>;
}) {
  const session = await requireRoleOrRedirect(
    ["admin", "staff", "realtor"],
    "teams",
  );
  const params = await searchParams;
  const scope = await teamScope(session);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  // Founder-flow surface for realtors with no memberships. Shown both when
  // arrived via the soft-gate redirect (?needs_team=1) and on direct visit
  // — the trigger is the user's actual state, not the URL flag.
  const isRealtorWithoutTeam =
    hasRole(session, "realtor") &&
    (await getUserTeamIds(session.user.id)).all.length === 0;
  const showFounderBanner = isRealtorWithoutTeam;
  const canFound = showFounderBanner && (await canCreateFirstTeam(session));
  // Suppress the "you tried to access X" prefix when arriving directly so
  // the banner reads naturally.
  const fromGate = params.needs_team === "1";

  const teams = await prisma.team.findMany({
    where: composeWhere(scope),
    orderBy: { name: "asc" },
    include: {
      members: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      assignments: {
        include: { services: true },
      },
    },
  });

  // Fetch services once to resolve color/short for pills
  const services = await prisma.service.findMany();
  const svcByKey = Object.fromEntries(services.map((s) => [s.key, s]));

  // Aggregate counters
  const totals = {
    teams: teams.length,
    members: teams.reduce((s, t) => s + t.members.length, 0),
    activeAssignments: teams.reduce(
      (s, t) => s + t.assignments.filter((a) => ["scheduled", "in_progress"].includes(a.status)).length,
      0,
    ),
    deliveredThisMonth: teams.reduce(
      (s, t) =>
        s + t.assignments.filter((a) => a.deliveredAt && a.deliveredAt >= monthStart).length,
      0,
    ),
  };

  return (
    <>
      <Topbar title="Teams" subtitle={`${totals.teams} offices`} />

      <div className="p-8 max-w-[1400px] space-y-6">
        {showFounderBanner && (
          <Card className="border-[var(--color-accent)]/30 bg-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-bg))]">
            <CardBody className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                >
                  <IconBuilding size={20} />
                </span>
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">
                    {fromGate
                      ? "You need a team before you can use that section."
                      : "Your agency isn't set up yet."}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                    {canFound
                      ? "Create your office to get started — you can invite teammates and order certificates afterwards."
                      : "Ask an administrator to create your office, or contact support if you're a new agency owner."}
                  </p>
                </div>
              </div>
              {canFound ? (
                <Button href="/dashboard/teams/new" size="md">
                  <IconPlus size={14} />
                  Create your office
                </Button>
              ) : (
                <Button
                  href="mailto:jordan@asbestexperts.be"
                  variant="secondary"
                  size="md"
                >
                  Contact support
                </Button>
              )}
            </CardBody>
          </Card>
        )}

        {/* Header summary */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-ink)]">
              {totals.teams} partner {totals.teams === 1 ? "office" : "offices"} across Belgium
            </h2>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {totals.members} total member{totals.members === 1 ? "" : "s"} ·{" "}
              {totals.activeAssignments} active assignment
              {totals.activeAssignments === 1 ? "" : "s"} ·{" "}
              {totals.deliveredThisMonth} delivered this month
            </p>
          </div>
          <Button href="/dashboard/teams/new" size="md">
            <IconPlus size={14} />
            Create team
          </Button>
        </div>

        {/* Grid */}
        {teams.length === 0 ? (
          <EmptyState
            variant="dashed"
            icon={<IconBuilding size={22} />}
            title="No teams yet"
            description="Create your first agency office. You'll be able to add members, set commission rules and order certificates on their behalf."
            action={
              <Button href="/dashboard/teams/new" size="md">
                <IconPlus size={14} />
                Create first team
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => {
              const active = team.assignments.filter((a) =>
                ["scheduled", "in_progress"].includes(a.status),
              ).length;
              const delivered = team.assignments.filter(
                (a) => a.deliveredAt && a.deliveredAt >= monthStart,
              ).length;

              // Count service usage
              const svcCount: Record<string, number> = {};
              for (const a of team.assignments) {
                for (const s of a.services) {
                  svcCount[s.serviceKey] = (svcCount[s.serviceKey] ?? 0) + 1;
                }
              }
              const topServices = Object.entries(svcCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([k]) => svcByKey[k])
                .filter(Boolean);

              const memberAvatars = team.members.slice(0, 4);
              const extraMembers = team.members.length - memberAvatars.length;
              const owner = team.members.find((m) => m.teamRole === "owner");

              return (
                <Card
                  key={team.id}
                  className="group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                >
                  <Link
                    href={`/dashboard/teams/${team.id}`}
                    aria-label={`Open ${team.name}`}
                    className="absolute inset-0 z-10 rounded-[var(--radius-lg)]"
                  />

                  {/* Colored accent strip */}
                  <div
                    aria-hidden
                    className="h-1 w-full"
                    style={{ backgroundColor: team.logoColor ?? "#0f172a" }}
                  />

                  <CardBody className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-sm font-bold text-white"
                          style={{ backgroundColor: team.logoColor ?? "#0f172a" }}
                        >
                          {team.logo ?? "??"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--color-ink)] group-hover:underline">
                            {team.name}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-[var(--color-ink-muted)]">
                            <IconMapPin size={11} />
                            {team.city ?? "—"}
                          </p>
                        </div>
                      </div>
                      <IconArrowRight
                        size={16}
                        className="mt-1 shrink-0 text-[var(--color-ink-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-ink-soft)]"
                      />
                    </div>

                    {/* Members row */}
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <div className="flex items-center">
                        {memberAvatars.length === 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
                            <IconUsers size={12} />
                            No members yet
                          </span>
                        ) : (
                          <div className="flex items-center -space-x-2">
                            {memberAvatars.map((m) => (
                              <span
                                key={m.userId}
                                className="relative ring-2 ring-[var(--color-bg)]"
                                style={{ borderRadius: "9999px" }}
                              >
                                <Avatar
                                  initials={initials(m.user.firstName, m.user.lastName)}
                                  size="sm"
                                />
                              </span>
                            ))}
                            {extraMembers > 0 && (
                              <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[var(--color-bg-muted)] text-[10px] font-semibold text-[var(--color-ink-soft)] ring-2 ring-[var(--color-bg)]">
                                +{extraMembers}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {owner && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                          <IconShield size={10} />
                          Owned by {owner.user.firstName}
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--color-border)] pt-4">
                      <Stat icon={<IconUsers size={12} />} label="Members" value={team.members.length} />
                      <Stat icon={<IconList size={12} />} label="Active" value={active} />
                      <Stat icon={<IconBuilding size={12} />} label="MTD" value={delivered} />
                    </dl>

                    {/* Service mix */}
                    {topServices.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                          Most ordered
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {topServices.map((svc) => (
                            <ServicePill key={svc.key} color={svc.color} label={svc.short} />
                          ))}
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
        <span className="text-[var(--color-ink-muted)]">{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold text-[var(--color-ink)] tabular-nums">
        {value}
      </dd>
    </div>
  );
}
