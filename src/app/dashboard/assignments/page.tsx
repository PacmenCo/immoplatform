import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { ServicePill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconList, IconPlus } from "@/components/ui/Icons";
import { STATUS_META, STATUS_ORDER, Status } from "@/lib/mockData";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import {
  assignmentScope,
  composeWhere,
  eligibleFreelancerWhere,
  hasRole,
  role,
  teamScope,
  type Role,
} from "@/lib/permissions";
import { initials } from "@/lib/format";
import { StatusPicker } from "./StatusPicker";
import { FiltersBar } from "./FiltersBar";
import { AssignmentFilesButton } from "./AssignmentFilesButton";
import type { Prisma } from "@prisma/client";

const SORTS = [
  { id: "created", label: "Created", column: "createdAt" as const },
  { id: "address", label: "Property", column: "address" as const },
  { id: "date", label: "Preferred date", column: "preferredDate" as const },
  { id: "status", label: "Status", column: "status" as const },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const EMPTY_COPY: Record<Role, { title: string; description: string }> = {
  admin: {
    title: "No assignments yet",
    description: "Create your first property inspection to get started.",
  },
  staff: {
    title: "No assignments yet",
    description: "Create your first property inspection to get started.",
  },
  realtor: {
    title: "No certificate orders yet for your team",
    description: "Click New assignment to order your team's first certificate.",
  },
  freelancer: {
    title: "No inspections assigned to you yet",
    description: "Once a realtor assigns you to an inspection, it shows up here.",
  },
};

type SearchParams = Promise<{
  status?: string;
  q?: string;
  team?: string;
  freelancer?: string;
  sort?: string;
  dir?: string;
}>;

/** Build a URL preserving active filters while overriding one field. */
function buildUrl(
  current: { status: Status | null; q: string; team: string; freelancer: string; sort: SortId; dir: "asc" | "desc" },
  patch: Partial<{ status: Status | null; q: string; team: string; freelancer: string; sort: SortId; dir: "asc" | "desc" }>,
): string {
  const next = { ...current, ...patch };
  const sp = new URLSearchParams();
  if (next.status) sp.set("status", next.status);
  if (next.q) sp.set("q", next.q);
  if (next.team) sp.set("team", next.team);
  if (next.freelancer) sp.set("freelancer", next.freelancer);
  if (next.sort !== "created") sp.set("sort", next.sort);
  if (next.dir !== "desc") sp.set("dir", next.dir);
  const qs = sp.toString();
  return qs ? `/dashboard/assignments?${qs}` : "/dashboard/assignments";
}

export default async function AssignmentsList({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const scope = await assignmentScope(session);
  const r = role(session);
  const isFreelancer = r === "freelancer";

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

  // Split on whitespace; every word must substring-match at least one
  // field (AND across words, OR across fields). So "brugge vastgoed" hits
  // any row where one field contains "brugge" AND some field (same or
  // different) contains "vastgoed".
  const words = q.split(/\s+/).filter(Boolean);
  const searchWhere: Prisma.AssignmentWhereInput | undefined = words.length
    ? {
        AND: words.map((w) => ({
          OR: [
            { reference: { contains: w } },
            { address: { contains: w } },
            { city: { contains: w } },
            { postal: { contains: w } },
            { team: { name: { contains: w } } },
            {
              freelancer: {
                OR: [
                  { firstName: { contains: w } },
                  { lastName: { contains: w } },
                  { email: { contains: w } },
                ],
              },
            },
            {
              createdBy: {
                OR: [
                  { firstName: { contains: w } },
                  { lastName: { contains: w } },
                  { email: { contains: w } },
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

  const [assignments, services, totalCount, visibleTeams, visibleFreelancers] = await Promise.all([
    prisma.assignment.findMany({
      where: listWhere,
      orderBy: { [sortColumn]: dir },
      include: {
        team: { select: { id: true, name: true } },
        freelancer: { select: { id: true, firstName: true, lastName: true } },
        services: true,
      },
    }),
    prisma.service.findMany(),
    prisma.assignment.count({ where: scopedWhere }),
    visibleTeamsPromise,
    visibleFreelancersPromise,
  ]);

  const servicesByKey = Object.fromEntries(services.map((s) => [s.key, s]));
  const anyFilterActive =
    activeStatus !== null ||
    q.length > 0 ||
    activeTeam !== "" ||
    activeFreelancer !== "";

  const currentState = {
    status: activeStatus,
    q,
    team: activeTeam,
    freelancer: activeFreelancer,
    sort,
    dir,
  };

  const subtitle = activeStatus
    ? `${assignments.length} ${STATUS_META[activeStatus].label.toLowerCase()} · ${totalCount} total`
    : `${assignments.length} total`;

  return (
    <>
      <Topbar title="Assignments" subtitle={subtitle} />

      <div className="p-8 space-y-4 max-w-[1400px]">
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
          {!isFreelancer && (
            <Button href="/dashboard/assignments/new" size="sm">
              <IconPlus size={14} />
              New
            </Button>
          )}
        </div>

        {assignments.length === 0 ? (
          <EmptyState
            variant="dashed"
            icon={<IconList size={22} />}
            title={
              anyFilterActive
                ? "No matching assignments"
                : EMPTY_COPY[r].title
            }
            description={
              anyFilterActive
                ? "Try broadening the filters — or reset to see all."
                : EMPTY_COPY[r].description
            }
            action={
              anyFilterActive ? (
                <Button href="/dashboard/assignments" variant="secondary" size="md">
                  Reset filters
                </Button>
              ) : isFreelancer ? undefined : (
                <Button href="/dashboard/assignments/new" size="md">
                  <IconPlus size={14} />
                  Create assignment
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
                    <SortHeader current={currentState} id="created" label="Reference" />
                    <SortHeader current={currentState} id="address" label="Property" />
                    <th className="text-left font-semibold px-6 py-3">Services</th>
                    <th className="text-left font-semibold px-6 py-3">Team</th>
                    <th className="text-left font-semibold px-6 py-3">Freelancer</th>
                    <SortHeader current={currentState} id="date" label="Preferred date" />
                    <SortHeader current={currentState} id="status" label="Status" />
                    <th className="text-left font-semibold px-6 py-3" aria-label="Files" />
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
                          <StatusPicker
                            assignmentId={a.id}
                            status={a.status as Status}
                            role={r}
                          />
                        </td>
                        <td className="px-2 py-3">
                          <AssignmentFilesButton
                            assignmentId={a.id}
                            reference={a.reference}
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
      </div>
    </>
  );
}

function SortHeader({
  current,
  id,
  label,
}: {
  current: { status: Status | null; q: string; team: string; freelancer: string; sort: SortId; dir: "asc" | "desc" };
  id: SortId;
  label: string;
}) {
  const isActive = current.sort === id;
  const nextDir: "asc" | "desc" = isActive && current.dir === "desc" ? "asc" : "desc";
  const href = buildUrl(current, { sort: id, dir: nextDir });
  return (
    <th className="text-left font-semibold px-6 py-3">
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
