import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/dashboard/SearchInput";
import {
  IconPlus,
  IconBuilding,
  IconMapPin,
  IconArrowRight,
} from "@/components/ui/Icons";
import { prisma } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/auth";
import {
  canCreateFirstTeam,
  canCreateTeam,
  composeWhere,
  getUserTeamIds,
  hasRole,
  teamScope,
} from "@/lib/permissions";

export const metadata = { title: "Teams" };

const SORT_FIELDS = ["name", "members", "assignments"] as const;
type SortField = (typeof SORT_FIELDS)[number];

type SearchParams = Promise<{
  q?: string;
  sort?: string;
  dir?: string;
  needs_team?: string;
}>;

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireRoleOrRedirect(
    ["admin", "staff", "realtor"],
    "teams",
  );
  const params = await searchParams;
  const scope = await teamScope(session);

  const q = (params.q ?? "").trim();
  const sort: SortField = (SORT_FIELDS as readonly string[]).includes(
    params.sort ?? "",
  )
    ? (params.sort as SortField)
    : "name";
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";

  // Realtors with no team get the founder banner. Detected by actual state,
  // not the URL flag — the flag only suppresses the "you tried to access X"
  // prefix when arriving via the soft-gate redirect.
  // Also doubles as the input for `canEdit` below — getUserTeamIds is
  // React-cache()'d so calling it once and reusing is the same cost as
  // calling twice.
  const isAdmin = hasRole(session, "admin");
  const userTeamIds = isAdmin ? null : await getUserTeamIds(session.user.id);
  const ownedTeamIds = new Set(userTeamIds?.owned ?? []);
  const isRealtorWithoutTeam =
    hasRole(session, "realtor") && (userTeamIds?.all.length ?? 0) === 0;
  // v1 parity: clicking a team row goes to /edit when the user can edit,
  // else to the read-only detail view (Platform's teams-list.blade.php:150
  // `onclick="window.location='{{ route('admin.teams.edit', $team) }}'"`).
  // Mirrors canEditTeam(): admin always; realtor iff they own the team;
  // staff falls through to detail (canEditTeam returns false for staff).
  const canEdit = (teamId: string) => isAdmin || ownedTeamIds.has(teamId);
  const showFounderBanner = isRealtorWithoutTeam;
  const canFound = showFounderBanner && (await canCreateFirstTeam(session));
  const fromGate = params.needs_team === "1";

  // Multi-word search across team name/city + owner first/last/email,
  // matching the assignments-page idiom (AND across words, OR across fields).
  // Insensitive mode mirrors v1 MySQL `LIKE` collation behaviour
  // (Platform/app/Livewire/TeamsList.php:62-71) on Postgres.
  const words = q.split(/\s+/).filter(Boolean);
  const searchWhere: Prisma.TeamWhereInput | undefined = words.length
    ? {
        AND: words.map((w) => ({
          OR: [
            { name: { contains: w, mode: "insensitive" as const } },
            { city: { contains: w, mode: "insensitive" as const } },
            {
              members: {
                some: {
                  user: {
                    OR: [
                      { firstName: { contains: w, mode: "insensitive" as const } },
                      { lastName: { contains: w, mode: "insensitive" as const } },
                      { email: { contains: w, mode: "insensitive" as const } },
                    ],
                  },
                },
              },
            },
          ],
        })),
      }
    : undefined;

  const where = composeWhere<Prisma.TeamWhereInput>(scope, searchWhere);

  const orderBy: Prisma.TeamOrderByWithRelationInput =
    sort === "members"
      ? { members: { _count: dir } }
      : sort === "assignments"
        ? { assignments: { _count: dir } }
        : { name: dir };

  const teams = await prisma.team.findMany({
    where,
    orderBy,
    include: {
      _count: { select: { members: true, assignments: true } },
      members: {
        where: { teamRole: "owner" },
        take: 1,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  const totals = {
    teams: teams.length,
    members: teams.reduce((s, t) => s + t._count.members, 0),
    assignments: teams.reduce((s, t) => s + t._count.assignments, 0),
  };

  const hasActiveSearch = q.length > 0;

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

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-ink)]">
              {totals.teams} partner{" "}
              {totals.teams === 1 ? "office" : "offices"} across Belgium
            </h2>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {totals.members} total member{totals.members === 1 ? "" : "s"} ·{" "}
              {totals.assignments} total assignment
              {totals.assignments === 1 ? "" : "s"}
            </p>
          </div>
          {(canCreateTeam(session) || canFound) && (
            <Button href="/dashboard/teams/new" size="md">
              <IconPlus size={14} />
              Create team
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            initialQuery={q}
            placeholder="Search by team name, city or owner…"
          />
        </div>

        {teams.length === 0 ? (
          hasActiveSearch ? (
            <EmptyState
              variant="dashed"
              icon={<IconBuilding size={22} />}
              title="No teams match that search"
              description={`Nothing found for "${q}". Try a different name, city, or owner.`}
            />
          ) : (
            <EmptyState
              variant="dashed"
              icon={<IconBuilding size={22} />}
              title="No teams yet"
              description="Create your first agency office. You'll be able to add members, set commission rules and order certificates on their behalf."
              action={
                (canCreateTeam(session) || canFound) ? (
                  <Button href="/dashboard/teams/new" size="md">
                    <IconPlus size={14} />
                    Create first team
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <DesktopTable teams={teams} q={q} sort={sort} dir={dir} canEdit={canEdit} />
            <MobileList teams={teams} canEdit={canEdit} />
          </>
        )}
      </div>
    </>
  );
}

type TeamRow = Prisma.TeamGetPayload<{
  include: {
    _count: { select: { members: true; assignments: true } };
    members: {
      where: { teamRole: "owner" };
      take: 1;
      include: {
        user: { select: { firstName: true; lastName: true; email: true } };
      };
    };
  };
}>;

function DesktopTable({
  teams,
  q,
  sort,
  dir,
  canEdit,
}: {
  teams: TeamRow[];
  canEdit: (teamId: string) => boolean;
  q: string;
  sort: SortField;
  dir: "asc" | "desc";
}) {
  return (
    <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-sm)] sm:block">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
            <tr>
              <SortHeader
                label="Office"
                field="name"
                q={q}
                currentSort={sort}
                currentDir={dir}
                className="px-6 py-3 text-left font-medium"
              />
              <th className="px-6 py-3 text-left font-medium">Owner</th>
              <SortHeader
                label="Members"
                field="members"
                q={q}
                currentSort={sort}
                currentDir={dir}
                className="px-6 py-3 text-left font-medium"
              />
              <SortHeader
                label="Assignments"
                field="assignments"
                q={q}
                currentSort={sort}
                currentDir={dir}
                className="px-6 py-3 text-left font-medium"
              />
              <th className="px-6 py-3" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {teams.map((team) => {
              const owner = team.members[0];
              return (
                <tr
                  key={team.id}
                  className="group cursor-pointer transition-colors hover:bg-[var(--color-bg-alt)]"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/teams/${team.id}${canEdit(team.id) ? "/edit" : ""}`}
                      className="flex items-center gap-3 text-[var(--color-ink)]"
                    >
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                        style={{
                          backgroundColor: team.logoColor ?? "#0f172a",
                        }}
                      >
                        {team.logo ?? "??"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium group-hover:underline">
                          {team.name}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-[var(--color-ink-muted)]">
                          <IconMapPin size={11} />
                          {team.city ?? "—"}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {owner ? (
                      <div className="min-w-0">
                        <p className="truncate text-[var(--color-ink)]">
                          {owner.user.firstName} {owner.user.lastName}
                        </p>
                        <p className="truncate text-xs text-[var(--color-ink-muted)]">
                          {owner.user.email}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--color-ink-muted)]">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 tabular-nums text-[var(--color-ink)]">
                    {team._count.members}
                  </td>
                  <td className="px-6 py-4 tabular-nums text-[var(--color-ink)]">
                    {team._count.assignments}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <IconArrowRight
                      size={16}
                      className="text-[var(--color-ink-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-ink-soft)]"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MobileList({ teams, canEdit }: { teams: TeamRow[]; canEdit: (teamId: string) => boolean }) {
  return (
    <div className="space-y-3 sm:hidden">
      {teams.map((team) => {
        const owner = team.members[0];
        return (
          <Card key={team.id} className="overflow-hidden">
            <Link
              href={`/dashboard/teams/${team.id}${canEdit(team.id) ? "/edit" : ""}`}
              className="block px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                  style={{ backgroundColor: team.logoColor ?? "#0f172a" }}
                >
                  {team.logo ?? "??"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--color-ink)]">
                    {team.name}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-[var(--color-ink-muted)]">
                    <IconMapPin size={11} />
                    {team.city ?? "—"}
                  </p>
                </div>
                <IconArrowRight
                  size={16}
                  className="shrink-0 text-[var(--color-ink-faint)]"
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 border-t border-[var(--color-border)] pt-3 text-xs">
                <div>
                  <p className="font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Owner
                  </p>
                  <p className="mt-0.5 truncate text-[var(--color-ink)]">
                    {owner
                      ? `${owner.user.firstName} ${owner.user.lastName}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Members
                  </p>
                  <p className="mt-0.5 tabular-nums text-[var(--color-ink)]">
                    {team._count.members}
                  </p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Assignments
                  </p>
                  <p className="mt-0.5 tabular-nums text-[var(--color-ink)]">
                    {team._count.assignments}
                  </p>
                </div>
              </div>
            </Link>
          </Card>
        );
      })}
    </div>
  );
}

function SortHeader({
  label,
  field,
  q,
  currentSort,
  currentDir,
  className,
}: {
  label: string;
  field: SortField;
  q: string;
  currentSort: SortField;
  currentDir: "asc" | "desc";
  className?: string;
}) {
  const isActive = currentSort === field;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";

  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  sp.set("sort", field);
  sp.set("dir", nextDir);
  const href = `/dashboard/teams?${sp.toString()}`;

  return (
    <th scope="col" className={className}>
      <Link
        href={href}
        className="inline-flex items-center gap-1 hover:text-[var(--color-ink)]"
        aria-sort={
          isActive
            ? currentDir === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        <span>{label}</span>
        <SortArrow active={isActive} dir={currentDir} />
      </Link>
    </th>
  );
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) {
    return (
      <svg
        aria-hidden
        width="10"
        height="10"
        viewBox="0 0 10 10"
        className="opacity-40"
      >
        <path
          d="M3 4l2-2 2 2M3 6l2 2 2-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg aria-hidden width="10" height="10" viewBox="0 0 10 10">
      <path
        d={dir === "asc" ? "M3 6l2-2 2 2" : "M3 4l2 2 2-2"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
