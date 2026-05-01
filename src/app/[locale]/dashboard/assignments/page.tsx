import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { localeRedirect } from "@/i18n/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { ServicePill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconList, IconPlus } from "@/components/ui/Icons";
import { STATUS_ORDER, Status } from "@/lib/mockData";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import {
  assignmentScope,
  buildCanEditAssignment,
  composeWhere,
  eligibleFreelancerWhere,
  gateRealtorRequiresTeam,
  hasRole,
  role,
  teamScope,
  type Role,
} from "@/lib/permissions";
import { initials } from "@/lib/format";
import { StatusPicker } from "./StatusPicker";
import { FiltersBar } from "./FiltersBar";
import { AssignmentFilesButton } from "./AssignmentFilesButton";
import { OdooSyncCell } from "./OdooSyncCell";
import { OdooColumnToggle } from "./OdooColumnToggle";
import { Pagination } from "./Pagination";
import type { Prisma } from "@prisma/client";

/**
 * Page size matches v1 Livewire (Platform/app/Livewire/AssignmentsList.php:294
 * `->paginate(20)`). Hardcoded — no UI to change it, like v1.
 */
const PAGE_SIZE = 20;

const SORTS = [
  { id: "created", column: "createdAt" as const },
  { id: "address", column: "address" as const },
  { id: "date", column: "preferredDate" as const },
  { id: "status", column: "status" as const },
] as const;
type SortId = (typeof SORTS)[number]["id"];

type SearchParams = Promise<{
  status?: string;
  q?: string;
  team?: string;
  freelancer?: string;
  sort?: string;
  dir?: string;
  page?: string;
}>;

type FilterState = {
  status: Status | null;
  q: string;
  team: string;
  freelancer: string;
  sort: SortId;
  dir: "asc" | "desc";
  page: number;
};

/**
 * Build a URL preserving active filters while overriding one field. `page` is
 * 1-indexed (Laravel-style); page 1 is the implicit default and never
 * serialized to the URL — keeps the unfiltered list URL clean.
 */
function buildUrl(
  current: FilterState,
  patch: Partial<FilterState>,
): string {
  const next = { ...current, ...patch };
  const sp = new URLSearchParams();
  if (next.status) sp.set("status", next.status);
  if (next.q) sp.set("q", next.q);
  if (next.team) sp.set("team", next.team);
  if (next.freelancer) sp.set("freelancer", next.freelancer);
  if (next.sort !== "created") sp.set("sort", next.sort);
  if (next.dir !== "desc") sp.set("dir", next.dir);
  if (next.page > 1) sp.set("page", String(next.page));
  const qs = sp.toString();
  return qs ? `/dashboard/assignments?${qs}` : "/dashboard/assignments";
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.pageTitles");
  return { title: t("assignments") };
}

export default async function AssignmentsList({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations("dashboard.assignments");
  const session = await requireSession();
  await gateRealtorRequiresTeam(session);
  const scope = await assignmentScope(session);
  const r = role(session);
  const isFreelancer = hasRole(session, "freelancer");

  // v1 parity: clicking a row goes to /edit when the user can edit, else
  // to the read-only detail view (Platform's assignments-list.blade.php
  // line 432: `@if($canEdit) ...edit @else ...show @endif`).
  // Odoo sync column is admin-only and hidden by default; OdooColumnToggle
  // (client island, localStorage-backed) reveals it via a CSS rule.
  const isAdmin = hasRole(session, "admin");
  const canEdit = await buildCanEditAssignment(session);

  const params = await searchParams;
  const activeStatus: Status | null = (STATUS_ORDER as readonly Status[]).includes(params.status as Status)
    ? (params.status as Status)
    : null;
  const q = (params.q ?? "").trim();
  const activeTeam = (params.team ?? "").trim();
  const activeFreelancer = (params.freelancer ?? "").trim();
  const sort: SortId = SORTS.some((s) => s.id === params.sort)
    ? (params.sort as SortId)
    : "created";
  const dir: "asc" | "desc" = params.dir === "asc" ? "asc" : "desc";
  const sortColumn = SORTS.find((s) => s.id === sort)!.column;
  // 1-indexed; clamp to ≥ 1. Anything non-numeric / ≤ 0 falls back to 1, just
  // like Laravel's `Paginator::resolveCurrentPage()`.
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? requestedPage : 1;

  // Split on whitespace; every word must substring-match at least one
  // field (AND across words, OR across fields). So "brugge vastgoed" hits
  // any row where one field contains "brugge" AND some field (same or
  // different) contains "vastgoed".
  // `mode: "insensitive"` matches v1 MySQL `LIKE` collation behavior
  // (Platform/app/Livewire/AssignmentsList.php:252-254) on Postgres.
  // Without it, "vrijdagmarkt" wouldn't match "Vrijdagmarkt".
  const words = q.split(/\s+/).filter(Boolean);
  const searchWhere: Prisma.AssignmentWhereInput | undefined = words.length
    ? {
        AND: words.map((w) => ({
          OR: [
            { reference: { contains: w, mode: "insensitive" } },
            { address: { contains: w, mode: "insensitive" } },
            { city: { contains: w, mode: "insensitive" } },
            { postal: { contains: w, mode: "insensitive" } },
            { team: { name: { contains: w, mode: "insensitive" } } },
            {
              freelancer: {
                OR: [
                  { firstName: { contains: w, mode: "insensitive" } },
                  { lastName: { contains: w, mode: "insensitive" } },
                  { email: { contains: w, mode: "insensitive" } },
                ],
              },
            },
            {
              createdBy: {
                OR: [
                  { firstName: { contains: w, mode: "insensitive" } },
                  { lastName: { contains: w, mode: "insensitive" } },
                  { email: { contains: w, mode: "insensitive" } },
                ],
              },
            },
          ],
        })),
      }
    : undefined;

  const teamWhere: Prisma.AssignmentWhereInput | undefined =
    activeTeam === "" ? undefined
    : activeTeam === "none" ? { teamId: null }
    : { teamId: activeTeam };

  // Freelancer filter mirrors the team pattern: ""=all, "none"=unassigned,
  // "<userId>"=that freelancer. Platform parity (AssignmentsList.php:53,75).
  const freelancerWhere: Prisma.AssignmentWhereInput | undefined =
    activeFreelancer === "" ? undefined
    : activeFreelancer === "none" ? { freelancerId: null }
    : { freelancerId: activeFreelancer };

  const statusWhere = activeStatus ? { status: activeStatus } : undefined;
  const listWhere = composeWhere(scope, statusWhere, searchWhere, teamWhere, freelancerWhere);
  const scopedWhere = composeWhere(scope);

  const canPickTeam = hasRole(session, "admin", "staff", "realtor");
  // Only admin/staff see the freelancer picker — Platform gates it to
  // medewerker/admin, and the list is hidden from the freelancer pool itself.
  const canPickFreelancer = hasRole(session, "admin", "staff");
  const visibleTeamsPromise = canPickTeam
    ? prisma.team.findMany({
        where: composeWhere(await teamScope(session)),
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : Promise.resolve<Array<{ id: string; name: string }>>([]);
  const visibleFreelancersPromise = canPickFreelancer
    ? prisma.user.findMany({
        where: eligibleFreelancerWhere(),
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        take: 500,
      })
    : Promise.resolve<Array<{ id: string; firstName: string; lastName: string }>>([]);

  // Skip the second count when no filter is active — `listWhere` and
  // `scopedWhere` resolve identically there, so the unfiltered query was
  // running twice in parallel for nothing.
  const anyFilterActive = !!(activeStatus || q || activeTeam || activeFreelancer);
  const [filteredCount, services, scopedTotal, visibleTeams, visibleFreelancers] = await Promise.all([
    prisma.assignment.count({ where: listWhere }),
    prisma.service.findMany(),
    anyFilterActive ? prisma.assignment.count({ where: scopedWhere }) : Promise.resolve(0),
    visibleTeamsPromise,
    visibleFreelancersPromise,
  ]);
  const totalCount = anyFilterActive ? scopedTotal : filteredCount;

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  // Out-of-range page on a non-empty list → bounce to the last page so users
  // who linger on a deep page after filters narrow the result still land
  // somewhere sensible. Empty result sets stay on page 1 (renders the empty
  // state) instead of redirecting to itself.
  if (page > totalPages && filteredCount > 0) {
    await localeRedirect(
      buildUrl(
        { status: activeStatus, q, team: activeTeam, freelancer: activeFreelancer, sort, dir, page },
        { page: totalPages },
      ),
    );
  }

  const assignments = await prisma.assignment.findMany({
    where: listWhere,
    orderBy: { [sortColumn]: dir },
    include: {
      team: { select: { id: true, name: true } },
      freelancer: { select: { id: true, firstName: true, lastName: true } },
      services: { select: { serviceKey: true } },
      _count: { select: { files: { where: { deletedAt: null } } } },
    },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const servicesByKey = Object.fromEntries(services.map((s) => [s.key, s]));

  const currentState: FilterState = {
    status: activeStatus,
    q,
    team: activeTeam,
    freelancer: activeFreelancer,
    sort,
    dir,
    page,
  };

  // Subtitle uses the filtered count (across all pages), not `assignments.length`
  // — that's now capped at PAGE_SIZE and would mis-report after pagination.
  const tStatuses = await getTranslations("dashboard.assignments.statuses");
  const subtitle = activeStatus
    ? t("list.subtitle.filtered", {
        filtered: filteredCount,
        statusLabel: tStatuses(activeStatus).toLowerCase(),
        total: totalCount,
      })
    : t("list.subtitle.totalOnly", { count: totalCount });

  const emptyTitle = anyFilterActive
    ? t("list.emptyMatching.title")
    : t(`list.emptyByRole.${r}.title` as const);
  const emptyDescription = anyFilterActive
    ? t("list.emptyMatching.description")
    : t(`list.emptyByRole.${r}.description` as const);

  return (
    <>
      <Topbar title={t("list.title")} subtitle={subtitle} />

      <div className="p-4 md:p-8 space-y-4 max-w-[1400px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FiltersBar
            initialQuery={q}
            initialStatus={activeStatus}
            initialTeam={activeTeam}
            initialFreelancer={activeFreelancer}
            canPickTeam={canPickTeam}
            canPickFreelancer={canPickFreelancer}
            teams={visibleTeams}
            freelancers={visibleFreelancers}
            resetHref="/dashboard/assignments"
            showReset={anyFilterActive}
          />
          <div className="flex items-center gap-2">
            {isAdmin && <OdooColumnToggle />}
            {!isFreelancer && (
              <Button href="/dashboard/assignments/new" size="sm">
                <IconPlus size={14} />
                {t("list.newCta")}
              </Button>
            )}
          </div>
        </div>

        {assignments.length === 0 ? (
          <EmptyState
            variant="dashed"
            icon={<IconList size={22} />}
            title={emptyTitle}
            description={emptyDescription}
            action={
              anyFilterActive ? (
                <Button href="/dashboard/assignments" variant="secondary" size="md">
                  {t("list.resetFilters")}
                </Button>
              ) : isFreelancer ? undefined : (
                <Button href="/dashboard/assignments/new" size="md">
                  <IconPlus size={14} />
                  {t("list.createCta")}
                </Button>
              )
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    <SortHeader current={currentState} id="created" label={t("list.columns.reference")} hideBelow="sm" />
                    <SortHeader current={currentState} id="address" label={t("list.columns.property")} />
                    <th scope="col" className="hidden sm:table-cell text-left font-semibold px-6 py-3">{t("list.columns.services")}</th>
                    <th scope="col" className="hidden md:table-cell text-left font-semibold px-6 py-3">{t("list.columns.team")}</th>
                    <th scope="col" className="hidden md:table-cell text-left font-semibold px-6 py-3">{t("list.columns.freelancer")}</th>
                    <SortHeader current={currentState} id="created" label={t("list.columns.created")} hideBelow="md" />
                    <SortHeader current={currentState} id="date" label={t("list.columns.plannedDate")} hideBelow="sm" />
                    <SortHeader current={currentState} id="status" label={t("list.columns.status")} />
                    {isAdmin && (
                      <th scope="col" className="odoo-col text-center font-semibold px-3 py-3">
                        <span title={t("list.odooHeaderTitle")} className="inline-block">{t("list.odooHeader")}</span>
                      </th>
                    )}
                    <th scope="col" className="hidden lg:table-cell text-left font-semibold px-6 py-3"><span className="sr-only">{t("list.filesHeader")}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {assignments.map((a) => {
                    const visibleServices = a.services.slice(0, 3);
                    const extraServices = a.services.length - visibleServices.length;
                    return (
                      <tr
                        key={a.id}
                        className="group transition-colors hover:bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
                      >
                        <td className="hidden sm:table-cell px-3 sm:px-6 py-3 whitespace-nowrap">
                          <Link
                            href={`/dashboard/assignments/${a.id}${canEdit(a) ? "/edit" : ""}`}
                            className="font-mono text-xs font-medium text-[var(--color-ink)] hover:underline"
                          >
                            {a.reference}
                          </Link>
                        </td>
                        <td className="px-3 sm:px-6 py-3">
                          <Link
                            href={`/dashboard/assignments/${a.id}${canEdit(a) ? "/edit" : ""}`}
                            className="block sm:contents"
                          >
                            <p className="text-sm font-medium text-[var(--color-ink)] leading-tight">
                              {a.address}
                            </p>
                            <p className="text-xs text-[var(--color-ink-muted)]">
                              {a.postal} {a.city}
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] text-[var(--color-ink-faint)] sm:hidden">
                              {a.reference}
                            </p>
                          </Link>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-3">
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
                        <td className="hidden md:table-cell px-6 py-3 whitespace-nowrap text-sm text-[var(--color-ink-soft)]">
                          {a.team ? (
                            <Link
                              href={`/dashboard/teams/${a.team.id}`}
                              className="hover:text-[var(--color-ink)] hover:underline"
                            >
                              {a.team.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="hidden md:table-cell px-6 py-3">
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
                              {t("shared.unassigned")}
                            </span>
                          )}
                        </td>
                        <td className="hidden md:table-cell px-6 py-3 whitespace-nowrap text-sm text-[var(--color-ink-soft)] tabular-nums">
                          {a.createdAt.toISOString().slice(0, 10)}
                        </td>
                        <td className="hidden sm:table-cell px-6 py-3 whitespace-nowrap text-sm text-[var(--color-ink-soft)] tabular-nums">
                          {a.preferredDate?.toISOString().slice(0, 10) ?? "—"}
                        </td>
                        <td className="px-3 sm:px-6 py-3">
                          <StatusPicker
                            assignmentId={a.id}
                            status={a.status as Status}
                            role={r}
                          />
                        </td>
                        {isAdmin && (
                          <td className="odoo-col px-3 py-3 text-center">
                            <OdooSyncCell
                              assignmentId={a.id}
                              odooSyncedAt={a.odooSyncedAt}
                              odooSyncError={a.odooSyncError}
                              odooContactId={a.odooContactId}
                              odooOrderId={a.odooOrderId}
                            />
                          </td>
                        )}
                        <td className="hidden lg:table-cell px-2 py-3">
                          <AssignmentFilesButton
                            assignmentId={a.id}
                            reference={a.reference}
                            fileCount={a._count.files}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {filteredCount > PAGE_SIZE && (
          <Pagination
            current={page}
            total={filteredCount}
            pageSize={PAGE_SIZE}
            buildUrl={(p) => buildUrl(currentState, { page: p })}
          />
        )}
      </div>
    </>
  );
}

function SortHeader({
  current,
  id,
  label,
  hideBelow,
}: {
  current: FilterState;
  id: SortId;
  label: string;
  hideBelow?: "sm" | "md" | "lg";
}) {
  const isActive = current.sort === id;
  const nextDir: "asc" | "desc" = isActive && current.dir === "desc" ? "asc" : "desc";
  // Re-sorting resets to page 1, mirroring v1's `updatingSortField` →
  // `resetPage()` (Platform/AssignmentsList.php:97-100). Otherwise a user
  // sitting on page 4 would land on a different slice of the new sort order.
  const href = buildUrl(current, { sort: id, dir: nextDir, page: 1 });
  const hideClass = hideBelow ? `hidden ${hideBelow}:table-cell ` : "";
  return (
    <th
      scope="col"
      aria-sort={isActive ? (current.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`${hideClass}text-left font-semibold px-3 sm:px-6 py-3`}
    >
      <Link
        href={href}
        className={
          "inline-flex items-center gap-1 uppercase tracking-wider " +
          (isActive ? "text-[var(--color-ink)]" : "hover:text-[var(--color-ink)]")
        }
      >
        {label}
        <SortArrow active={isActive} dir={current.dir} />
      </Link>
    </th>
  );
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) {
    return (
      <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className="opacity-40">
        <path d="M3 4l2-2 2 2M3 6l2 2 2-2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
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
