import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { localeRedirect } from "@/i18n/navigation";
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
import { Pagination } from "../assignments/Pagination";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.pageTitles");
  return { title: t("teams") };
}

const SORT_FIELDS = ["name", "members", "assignments"] as const;
type SortField = (typeof SORT_FIELDS)[number];

// v1 parity: Platform/app/Livewire/TeamsList.php:83 paginates 20/page.
const PAGE_SIZE = 20;

type SearchParams = Promise<{
  q?: string;
  sort?: string;
  dir?: string;
  page?: string;
  needs_team?: string;
}>;

type FilterState = {
  q: string;
  sort: SortField;
  dir: "asc" | "desc";
  page: number;
};

/**
 * Build a URL preserving active filters while overriding one field. `page` is
 * 1-indexed; page 1 is the implicit default and never serialized — keeps the
 * unfiltered list URL clean. `sort` and `dir` are always emitted to match the
 * pre-pagination link convention (the e2e test asserts on `sort=name` even
 * when name is the default). `needs_team` is intentionally not threaded —
 * it's a one-shot flag from the soft-gate redirect that should drop on the
 * first interaction.
 */
function buildUrl(current: FilterState, patch: Partial<FilterState>): string {
  const next = { ...current, ...patch };
  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  sp.set("sort", next.sort);
  sp.set("dir", next.dir);
  if (next.page > 1) sp.set("page", String(next.page));
  return `/dashboard/teams?${sp.toString()}`;
}

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations("dashboard.teams.list");
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
  // 1-indexed; clamp to ≥ 1. Anything non-numeric / ≤ 0 falls back to 1, just
  // like Laravel's `Paginator::resolveCurrentPage()`.
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? requestedPage : 1;

  // Realtors with no team get the founder banner. Detected by actual state,
  // not the URL flag — the flag only suppresses the "you tried to access X"
  // prefix when arriving via the soft-gate redirect.
  const isAdmin = hasRole(session, "admin");
  const userTeamIds = isAdmin ? null : await getUserTeamIds(session.user.id);
  const isRealtorWithoutTeam =
    hasRole(session, "realtor") && (userTeamIds?.all.length ?? 0) === 0;
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

  const [filteredCount, teams] = await Promise.all([
    prisma.team.count({ where }),
    prisma.team.findMany({
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
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  // Out-of-range page on a non-empty list → bounce to the last page so users
  // who linger on a deep page after filters narrow the result still land
  // somewhere sensible. Empty result sets stay on page 1 (renders the empty
  // state) instead of redirecting to itself. Mirrors the assignments page.
  if (page > totalPages && filteredCount > 0) {
    await localeRedirect(buildUrl({ q, sort, dir, page }, { page: totalPages }));
  }

  const currentState: FilterState = { q, sort, dir, page };
  const hasActiveSearch = q.length > 0;

  return (
    <>
      <Topbar
        title={t("topbarTitle")}
        subtitle={t("topbarSubtitle", { count: filteredCount })}
      />

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
                      ? t("founderBanner.titleFromGate")
                      : t("founderBanner.titleDefault")}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                    {canFound
                      ? t("founderBanner.bodyCanFound")
                      : t("founderBanner.bodyCannotFound")}
                  </p>
                </div>
              </div>
              {canFound ? (
                <Button href="/dashboard/teams/new" size="md">
                  <IconPlus size={14} />
                  {t("founderBanner.createOffice")}
                </Button>
              ) : (
                <Button
                  href="mailto:jordan@asbestexperts.be"
                  variant="secondary"
                  size="md"
                >
                  {t("founderBanner.contactSupport")}
                </Button>
              )}
            </CardBody>
          </Card>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-ink)]">
              {t("headline", { count: filteredCount })}
            </h2>
          </div>
          {(canCreateTeam(session) || canFound) && (
            <Button href="/dashboard/teams/new" size="md">
              <IconPlus size={14} />
              {t("createTeam")}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            initialQuery={q}
            placeholder={t("searchPlaceholder")}
          />
        </div>

        {teams.length === 0 ? (
          hasActiveSearch ? (
            <EmptyState
              variant="dashed"
              icon={<IconBuilding size={22} />}
              title={t("empty.noMatchTitle")}
              description={t("empty.noMatchDescription", { query: q })}
            />
          ) : (
            <EmptyState
              variant="dashed"
              icon={<IconBuilding size={22} />}
              title={t("empty.noTeamsTitle")}
              description={t("empty.noTeamsDescription")}
              action={
                (canCreateTeam(session) || canFound) ? (
                  <Button href="/dashboard/teams/new" size="md">
                    <IconPlus size={14} />
                    {t("empty.createFirst")}
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <DesktopTable
              teams={teams}
              currentState={currentState}
              labels={{
                office: t("columns.office"),
                owner: t("columns.owner"),
                members: t("columns.members"),
                assignments: t("columns.assignments"),
                noCity: t("noCity"),
                noOwner: t("noOwner"),
              }}
            />
            <MobileList
              teams={teams}
              labels={{
                owner: t("mobile.owner"),
                members: t("mobile.members"),
                assignments: t("mobile.assignments"),
                noCity: t("noCity"),
                noOwner: t("noOwner"),
              }}
            />
            {filteredCount > PAGE_SIZE && (
              <Pagination
                current={page}
                total={filteredCount}
                pageSize={PAGE_SIZE}
                buildUrl={(p) => buildUrl(currentState, { page: p })}
              />
            )}
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

type TableLabels = {
  office: string;
  owner: string;
  members: string;
  assignments: string;
  noCity: string;
  noOwner: string;
};

function DesktopTable({
  teams,
  currentState,
  labels,
}: {
  teams: TeamRow[];
  currentState: FilterState;
  labels: TableLabels;
}) {
  return (
    <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-sm)] sm:block">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
            <tr>
              <SortHeader
                label={labels.office}
                field="name"
                currentState={currentState}
                className="px-6 py-3 text-left font-medium"
              />
              <th className="px-6 py-3 text-left font-medium">{labels.owner}</th>
              <SortHeader
                label={labels.members}
                field="members"
                currentState={currentState}
                className="px-6 py-3 text-left font-medium"
              />
              <SortHeader
                label={labels.assignments}
                field="assignments"
                currentState={currentState}
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
                  className="group relative cursor-pointer transition-colors hover:bg-[var(--color-bg-alt)]"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/teams/${team.id}`}
                      className="flex items-center gap-3 text-[var(--color-ink)] before:absolute before:inset-0 before:content-['']"
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
                          {team.city ?? labels.noCity}
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
                        {labels.noOwner}
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

function MobileList({
  teams,
  labels,
}: {
  teams: TeamRow[];
  labels: { owner: string; members: string; assignments: string; noCity: string; noOwner: string };
}) {
  return (
    <div className="space-y-3 sm:hidden">
      {teams.map((team) => {
        const owner = team.members[0];
        return (
          <Card key={team.id} className="overflow-hidden">
            <Link
              href={`/dashboard/teams/${team.id}`}
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
                    {team.city ?? labels.noCity}
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
                    {labels.owner}
                  </p>
                  <p className="mt-0.5 truncate text-[var(--color-ink)]">
                    {owner
                      ? `${owner.user.firstName} ${owner.user.lastName}`
                      : labels.noOwner}
                  </p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    {labels.members}
                  </p>
                  <p className="mt-0.5 tabular-nums text-[var(--color-ink)]">
                    {team._count.members}
                  </p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    {labels.assignments}
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
  currentState,
  className,
}: {
  label: string;
  field: SortField;
  currentState: FilterState;
  className?: string;
}) {
  const isActive = currentState.sort === field;
  const nextDir = isActive && currentState.dir === "asc" ? "desc" : "asc";
  // Re-sorting resets to page 1, mirroring the assignments page — sitting on
  // page 4 of an old sort would otherwise land on a different slice of the
  // new ordering.
  const href = buildUrl(currentState, { sort: field, dir: nextDir, page: 1 });

  return (
    <th scope="col" className={className}>
      <Link
        href={href}
        className="inline-flex items-center gap-1 hover:text-[var(--color-ink)]"
        aria-sort={
          isActive
            ? currentState.dir === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        <span>{label}</span>
        <SortArrow active={isActive} dir={currentState.dir} />
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
