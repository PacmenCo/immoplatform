import { notFound } from "next/navigation";
import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, ServicePill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import {
  IconPlus,
  IconMail,
  IconPhone,
  IconMapPin,
  IconCheck,
  IconShield,
  IconList,
  IconBuilding,
  IconArrowRight,
  IconFileText,
} from "@/components/ui/Icons";
import { STATUS_META, Status } from "@/lib/mockData";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { buildCanEditAssignment, canEditTeam, getUserTeamIds, hasRole } from "@/lib/permissions";
import { formatCommissionRate, formatEuros, initials } from "@/lib/format";
import { quarterOf, quarterRange } from "@/lib/commission";
import { roleBadge } from "@/lib/roleColors";
import { teamLogoImageUrl, teamSignatureImageUrl } from "@/lib/teamBranding";
import { StatCard } from "@/components/dashboard/StatCard";
import { TransferOwnershipButton } from "./TransferOwnershipButton";
import { DeleteTeamButton } from "./DeleteTeamButton";
import { RemoveMemberButton } from "./RemoveMemberButton";
import { updateTeamBilling } from "@/app/actions/teams";

type TabId = "overview" | "members" | "assignments" | "billing" | "branding" | "services" | "commission";

const BASE_TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "members", label: "Members" },
  { id: "assignments", label: "Assignments" },
  { id: "billing", label: "Billing" },
  { id: "branding", label: "Branding" },
];

// Services & pricing + Commission sections are admin-only (sections
// themselves are wrapped in `{isAdmin && …}`). Filter the tab nav so
// non-admins don't get dead anchor links.
const ADMIN_TABS: Array<{ id: TabId; label: string }> = [
  { id: "services", label: "Services & pricing" },
  { id: "commission", label: "Commission" },
];

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const canEdit = await buildCanEditAssignment(session);

  // Non-privileged users can only view teams they're a member of.
  if (!hasRole(session, "admin", "staff")) {
    const { all } = await getUserTeamIds(session.user.id);
    if (!all.includes(id)) notFound();
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const now = new Date();
  const current = quarterOf(now);
  const currentRange = quarterRange(current.year, current.quarter);

  const [team, services, recentPayouts, currentAccrual, pendingInvites] =
    await Promise.all([
      prisma.team.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true,
                },
              },
            },
            orderBy: { joinedAt: "asc" },
          },
          assignments: {
            orderBy: { preferredDate: "desc" },
            take: 20,
            include: {
              services: true,
              freelancer: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          serviceOverrides: true,
        },
      }),
      prisma.service.findMany({ orderBy: { key: "asc" } }),
      prisma.commissionPayout.findMany({
        where: { teamId: id },
        orderBy: [{ year: "desc" }, { quarter: "desc" }],
        take: 4,
        select: {
          id: true,
          year: true,
          quarter: true,
          amountCents: true,
          paidAt: true,
        },
      }),
      prisma.assignmentCommission.aggregate({
        where: { teamId: id, computedAt: { gte: currentRange.gte, lt: currentRange.lt } },
        _sum: { commissionAmountCents: true },
        _count: { _all: true },
      }),
      // Outstanding invites for this team — so admins/owners can see who
      // they've invited but who hasn't accepted yet. Without this, the
      // members panel silently omits pending invites until they land.
      prisma.invite.findMany({
        where: { teamId: id, acceptedAt: null, revokedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          role: true,
          teamRole: true,
          createdAt: true,
          expiresAt: true,
        },
      }),
    ]);

  if (!team) notFound();

  const logoImageUrl = teamLogoImageUrl({ id, logoUrl: team.logoUrl });
  const signatureImageUrl = teamSignatureImageUrl({ id, signatureUrl: team.signatureUrl });

  const currentAmount = currentAccrual._sum.commissionAmountCents ?? 0;
  const currentLineCount = currentAccrual._count._all;
  const currentPayout = recentPayouts.find(
    (p) => p.year === current.year && p.quarter === current.quarter,
  );
  // Show the running quarter as a live row (unless it's already paid — in
  // which case the payout row from findMany carries the snapshot). Older
  // payouts follow, most recent first.
  const commissionActivity: Array<{
    key: string;
    period: string;
    amountCents: number;
    status: "current" | "paid";
    paidAt: Date | null;
  }> = [];
  if (!currentPayout && (currentAmount > 0 || currentLineCount > 0)) {
    commissionActivity.push({
      key: `current-${current.year}-${current.quarter}`,
      period: `Q${current.quarter} ${current.year}`,
      amountCents: currentAmount,
      status: "current",
      paidAt: null,
    });
  }
  for (const p of recentPayouts.slice(0, 3)) {
    commissionActivity.push({
      key: p.id,
      period: `Q${p.quarter} ${p.year}`,
      amountCents: p.amountCents,
      status: "paid",
      paidAt: p.paidAt,
    });
  }

  const svcByKey = Object.fromEntries(services.map((s) => [s.key, s]));
  const overrideByKey = Object.fromEntries(
    team.serviceOverrides.map((o) => [o.serviceKey, o.priceCents]),
  );

  const owner = team.members.find((m) => m.teamRole === "owner");
  const activeCount = team.assignments.filter((a) =>
    ["scheduled", "in_progress"].includes(a.status),
  ).length;
  const deliveredMtd = team.assignments.filter(
    (a) => a.deliveredAt && a.deliveredAt >= monthStart,
  ).length;

  const serviceCount: Record<string, number> = {};
  for (const a of team.assignments) {
    for (const s of a.services) {
      serviceCount[s.serviceKey] = (serviceCount[s.serviceKey] ?? 0) + 1;
    }
  }

  const commissionLabel = team.commissionType
    ? team.commissionType === "percentage"
      ? `${formatCommissionRate(team.commissionType, team.commissionValue)} of revenue`
      : `${formatCommissionRate(team.commissionType, team.commissionValue)} flat fee`
    : "Not configured";

  // Transfer-ownership eligibility (admin OR team-owner per canEditTeam).
  const canTransfer = await canEditTeam(session, id);
  // v1 parity: delete + commission config + per-team price overrides are
  // admin-only — realtor-owners can edit the team's branding, contact info,
  // and member roster, but not these three.
  const isAdmin = hasRole(session, "admin");

  // Inline billing-section save (v1 parity with Platform's TeamEdit Livewire,
  // where the legal/billing fields edit on the same page that displays them).
  // Bound action takes only FormData — withSession injects session, the bind
  // pins teamId + the unused `_prev` slot. Cast to a void-returning shape
  // because <form action> only types as Promise<void>; the ActionResult the
  // wrapped action returns is intentionally discarded here (no useActionState
  // on this server-rendered page — errors surface via the action throwing
  // or via the page re-rendering with stale data).
  const boundUpdateBilling = updateTeamBilling.bind(null, id, undefined) as unknown as (
    formData: FormData,
  ) => Promise<void>;
  const eligibleOwners = team.members
    .filter(
      (m) =>
        m.teamRole === "member" &&
        ["realtor", "admin"].includes(m.user.role),
    )
    .map((m) => ({
      userId: m.user.id,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      email: m.user.email,
    }));

  return (
    <>
      <Topbar
        title={team.name}
        subtitle={`${team.city ?? "—"} · ${team.members.length} members`}
      />

      <div className="p-8 max-w-[1300px] space-y-6">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]"
        >
          <Link href="/dashboard/teams" className="hover:text-[var(--color-ink)]">
            Teams
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[var(--color-ink-soft)]">{team.name}</span>
        </nav>

        {/* Hero */}
        <Card className="overflow-hidden">
          <div
            aria-hidden
            className="h-2 w-full"
            style={{ backgroundColor: team.logoColor ?? "#0f172a" }}
          />
          <CardBody className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <span
                className="grid h-16 w-16 shrink-0 place-items-center rounded-lg text-xl font-bold text-white"
                style={{ backgroundColor: team.logoColor ?? "#0f172a" }}
              >
                {team.logo ?? "??"}
              </span>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                  Team · created {team.createdAt.toISOString().slice(0, 10)}
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                  {team.name}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-[var(--color-ink-soft)]">
                  {team.city && (
                    <span className="inline-flex items-center gap-1">
                      <IconMapPin size={12} className="text-[var(--color-ink-muted)]" />
                      {team.city}
                    </span>
                  )}
                  {team.email && (
                    <>
                      <span className="text-[var(--color-ink-faint)]">·</span>
                      <a
                        href={`mailto:${team.email}`}
                        className="inline-flex items-center gap-1 hover:text-[var(--color-ink)]"
                      >
                        <IconMail size={12} className="text-[var(--color-ink-muted)]" />
                        {team.email}
                      </a>
                    </>
                  )}
                  {owner && (
                    <>
                      <span className="text-[var(--color-ink-faint)]">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <IconShield size={12} className="text-[var(--color-ink-muted)]" />
                        Owner:{" "}
                        <Link
                          href={`/dashboard/users/${owner.user.id}`}
                          className="font-medium text-[var(--color-ink)] hover:underline"
                        >
                          {owner.user.firstName} {owner.user.lastName}
                        </Link>
                      </span>
                    </>
                  )}
                </div>
                {team.description && (
                  <p className="mt-2 max-w-xl text-sm text-[var(--color-ink-soft)]">
                    {team.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button href="/dashboard/teams" variant="ghost" size="sm">
                ← All teams
              </Button>
              {canTransfer && (
                <Button
                  href={`/dashboard/users/invite?teamId=${id}`}
                  variant="secondary"
                  size="sm"
                >
                  <IconPlus size={14} />
                  Invite member
                </Button>
              )}
              {canTransfer && (
                <Button href={`/dashboard/teams/${id}/edit`} size="sm">
                  Edit team
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Summary stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard
            label="Members"
            value={team.members.length.toString()}
            hint={owner ? "Has an owner" : "No owner assigned"}
          />
          <StatCard
            label="Active"
            value={activeCount.toString()}
            hint="Scheduled or in progress"
            tone="warn"
          />
          <StatCard
            label="Delivered (MTD)"
            value={deliveredMtd.toString()}
            hint={`Since ${monthStart.toISOString().slice(0, 10)}`}
            tone="ok"
          />
          <StatCard
            label="Commission"
            value={commissionLabel}
            hint={team.defaultClientType ? `Invoices ${team.defaultClientType} by default` : undefined}
          />
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto border-b border-[var(--color-border)]">
          {[...BASE_TABS, ...(isAdmin ? ADMIN_TABS : [])].map((t, i) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={
                "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors -mb-px " +
                (i === 0
                  ? "border-[var(--color-brand)] font-medium text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]")
              }
            >
              {t.label}
            </a>
          ))}
        </nav>

        {/* ───── Overview ─────────────────────────────────────────── */}
        <section id="overview" className="grid gap-6 lg:grid-cols-[1fr_340px] scroll-mt-20">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent assignments</CardTitle>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                    Latest work carried out for this team.
                  </p>
                </div>
                <a
                  href="#assignments"
                  className="text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                >
                  View all →
                </a>
              </CardHeader>
              <CardBody className="p-0">
                {team.assignments.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
                    No assignments yet for this team.
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {team.assignments.slice(0, 5).map((a) => {
                      const meta = STATUS_META[a.status as Status] ?? STATUS_META.draft;
                      return (
                        <li key={a.id}>
                          <Link
                            href={`/dashboard/assignments/${a.id}${canEdit(a) ? "/edit" : ""}`}
                            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-3 transition-colors hover:bg-[var(--color-bg-alt)]"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-[var(--color-ink-muted)]">
                                  {a.reference}
                                </span>
                                <Badge bg={meta.bg} fg={meta.fg} size="sm">
                                  {meta.label}
                                </Badge>
                              </div>
                              <p className="mt-0.5 text-sm font-medium text-[var(--color-ink)]">
                                {a.address}, {a.city}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              {a.services.slice(0, 3).map((s) => {
                                const svc = svcByKey[s.serviceKey];
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
                              className="text-[var(--color-ink-faint)]"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>

            {/* Key facts */}
            <Card>
              <CardHeader>
                <CardTitle>Team facts</CardTitle>
              </CardHeader>
              <CardBody>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Fact label="Legal name" value={team.legalName} />
                  <Fact label="VAT number" value={team.vatNumber} mono />
                  <Fact label="KBO number" value={team.kboNumber} mono />
                  <Fact label="IBAN" value={team.iban} mono />
                  <Fact
                    label="Default invoice recipient"
                    value={
                      team.defaultClientType
                        ? team.defaultClientType === "firm"
                          ? "Firm / agency"
                          : "Property owner"
                        : null
                    }
                  />
                  <Fact
                    label="Logo on photo exports"
                    value={team.prefersLogoOnPhotos ? "Enabled" : "Disabled"}
                  />
                </dl>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Service mix</CardTitle>
                <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                  What this team orders most.
                </p>
              </CardHeader>
              <CardBody className="space-y-3">
                {services.map((svc) => {
                  const count = serviceCount[svc.key] ?? 0;
                  const max = Math.max(1, ...Object.values(serviceCount));
                  const pct = (count / max) * 100;
                  return (
                    <div key={svc.key}>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <ServicePill color={svc.color} label={svc.short} />
                          <span className="text-[var(--color-ink-soft)]">{svc.label}</span>
                        </div>
                        <span className="font-medium tabular-nums text-[var(--color-ink)]">
                          {count}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: svc.color,
                            opacity: count > 0 ? 1 : 0.15,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick actions</CardTitle>
              </CardHeader>
              <CardBody className="space-y-1 text-sm">
                <QuickLink
                  href="/dashboard/assignments/new"
                  icon={<IconList size={14} />}
                  label="Create assignment"
                />
                {canTransfer && (
                  <QuickLink
                    href={`/dashboard/users/invite?teamId=${id}`}
                    icon={<IconMail size={14} />}
                    label="Invite member"
                  />
                )}
                <QuickLink href="#billing" icon={<IconFileText size={14} />} label="Edit billing details" />
                {isAdmin && (
                  <QuickLink
                    href="#commission"
                    icon={<IconBuilding size={14} />}
                    label="Adjust commission"
                  />
                )}
              </CardBody>
            </Card>
          </div>
        </section>

        {/* ───── Members ──────────────────────────────────────────── */}
        <section id="members" className="scroll-mt-20">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Members</CardTitle>
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                  {team.members.length}{" "}
                  {team.members.length === 1 ? "person has" : "people have"} access to this team.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <TransferOwnershipButton
                    teamId={id}
                    teamName={team.name}
                    eligible={eligibleOwners}
                  />
                )}
                {canTransfer && (
                  <Button href={`/dashboard/users/invite?teamId=${id}`} size="sm">
                    <IconPlus size={14} />
                    Invite member
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {team.members.length === 0 ? (
                <div className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
                  No members yet. Invite someone to get started.
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold">Name</th>
                      <th className="px-6 py-3 text-left font-semibold">Email</th>
                      <th className="px-6 py-3 text-left font-semibold">Platform role</th>
                      <th className="px-6 py-3 text-left font-semibold">Team role</th>
                      <th className="px-6 py-3 text-left font-semibold">Joined</th>
                      <th className="px-6 py-3 text-right font-semibold" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {team.members.map((m) => {
                      const rb = roleBadge(m.user.role);
                      return (
                        <tr key={m.userId} className="hover:bg-[var(--color-bg-alt)]">
                          <td className="px-6 py-3">
                            <Link
                              href={`/dashboard/users/${m.user.id}`}
                              className="flex items-center gap-3"
                            >
                              <Avatar
                                initials={initials(m.user.firstName, m.user.lastName)}
                                size="sm"
                              />
                              <span className="font-medium text-[var(--color-ink)] hover:underline">
                                {m.user.firstName} {m.user.lastName}
                              </span>
                            </Link>
                          </td>
                          <td className="px-6 py-3 text-[var(--color-ink-soft)]">{m.user.email}</td>
                          <td className="px-6 py-3">
                            <Badge bg={rb.bg} fg={rb.fg} size="sm">
                              <span className="capitalize">{m.user.role}</span>
                            </Badge>
                          </td>
                          <td className="px-6 py-3">
                            {m.teamRole === "owner" ? (
                              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-brand)]">
                                <IconShield size={12} />
                                Owner
                              </span>
                            ) : (
                              <span className="text-sm text-[var(--color-ink-soft)]">Member</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-sm text-[var(--color-ink-muted)] tabular-nums">
                            {m.joinedAt.toISOString().slice(0, 10)}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {canTransfer && m.teamRole !== "owner" && m.userId !== session.user.id ? (
                              <RemoveMemberButton
                                teamId={id}
                                userId={m.userId}
                                memberName={`${m.user.firstName} ${m.user.lastName}`}
                                teamName={team.name}
                              />
                            ) : (
                              <span className="text-xs text-[var(--color-ink-muted)]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
              {pendingInvites.length > 0 && (
                <div className="border-t border-[var(--color-border)]">
                  <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                      Pending invites
                    </p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      {pendingInvites.length}{" "}
                      {pendingInvites.length === 1 ? "invite" : "invites"} awaiting acceptance
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                        <tr>
                          <th className="px-6 py-3 text-left font-semibold">Email</th>
                          <th className="px-6 py-3 text-left font-semibold">Role</th>
                          <th className="px-6 py-3 text-left font-semibold">Team role</th>
                          <th className="px-6 py-3 text-left font-semibold">Invited</th>
                          <th className="px-6 py-3 text-left font-semibold">Expires</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {pendingInvites.map((inv) => (
                          <tr key={inv.id}>
                            <td className="px-6 py-3 font-mono text-xs text-[var(--color-ink)]">
                              {inv.email}
                            </td>
                            <td className="px-6 py-3 capitalize text-[var(--color-ink-soft)]">
                              {inv.role}
                            </td>
                            <td className="px-6 py-3 capitalize text-[var(--color-ink-soft)]">
                              {inv.teamRole}
                            </td>
                            <td className="px-6 py-3 tabular-nums text-[var(--color-ink-soft)]">
                              {inv.createdAt.toISOString().slice(0, 10)}
                            </td>
                            <td className="px-6 py-3 tabular-nums text-[var(--color-ink-soft)]">
                              {inv.expiresAt?.toISOString().slice(0, 10) ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </section>

        {/* ───── Assignments ──────────────────────────────────────── */}
        <section id="assignments" className="scroll-mt-20">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Assignments</CardTitle>
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                  All work carried out for this team.
                </p>
              </div>
              <Button href="/dashboard/assignments/new" variant="secondary" size="sm">
                <IconPlus size={14} />
                New
              </Button>
            </CardHeader>
            <CardBody className="p-0">
              {team.assignments.length === 0 ? (
                <div className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
                  No assignments yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold">Reference</th>
                      <th className="px-6 py-3 text-left font-semibold">Property</th>
                      <th className="px-6 py-3 text-left font-semibold">Services</th>
                      <th className="px-6 py-3 text-left font-semibold">Freelancer</th>
                      <th className="px-6 py-3 text-left font-semibold">Date</th>
                      <th className="px-6 py-3 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {team.assignments.map((a) => {
                      const meta = STATUS_META[a.status as Status] ?? STATUS_META.draft;
                      return (
                        <tr
                          key={a.id}
                          className="transition-colors hover:bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
                        >
                          <td className="px-6 py-3">
                            <Link
                              href={`/dashboard/assignments/${a.id}${canEdit(a) ? "/edit" : ""}`}
                              className="font-mono text-xs font-medium text-[var(--color-ink)] hover:underline"
                            >
                              {a.reference}
                            </Link>
                          </td>
                          <td className="px-6 py-3">
                            <p className="text-sm font-medium text-[var(--color-ink)]">
                              {a.address}
                            </p>
                            <p className="text-xs text-[var(--color-ink-muted)]">
                              {a.postal} {a.city}
                            </p>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex gap-1">
                              {a.services.map((s) => {
                                const svc = svcByKey[s.serviceKey];
                                return svc ? (
                                  <ServicePill
                                    key={s.serviceKey}
                                    color={svc.color}
                                    label={svc.short}
                                  />
                                ) : null;
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-sm text-[var(--color-ink-soft)]">
                            {a.freelancer ? (
                              `${a.freelancer.firstName} ${a.freelancer.lastName}`
                            ) : (
                              <span className="italic text-[var(--color-ink-faint)]">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-sm text-[var(--color-ink-soft)] tabular-nums">
                            {a.preferredDate?.toISOString().slice(0, 10) ?? "—"}
                          </td>
                          <td className="px-6 py-3">
                            <Badge bg={meta.bg} fg={meta.fg} size="sm">
                              {meta.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </CardBody>
          </Card>
        </section>

        {/* ───── Billing ──────────────────────────────────────────── */}
        <section id="billing" className="scroll-mt-20">
          <Card>
            <form action={canTransfer ? boundUpdateBilling : undefined}>
              <CardHeader>
                <CardTitle>Billing & legal</CardTitle>
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                  Legal entity details for invoices issued to and from this team.
                </p>
              </CardHeader>
              <CardBody className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Legal name" id="legal-name" hint="Official entity name on invoices">
                    <Input id="legal-name" name="legalName" defaultValue={team.legalName ?? ""} placeholder="e.g. Vastgoed Antwerp BVBA" disabled={!canTransfer} autoComplete="off" />
                  </Field>
                  <Field label="Contact email" id="team-email" hint="Team-wide inbox for notifications">
                    <Input id="team-email" name="email" type="email" defaultValue={team.email ?? ""} placeholder="contact@team.be" disabled={!canTransfer} autoComplete="off" />
                  </Field>
                  <Field label="VAT number" id="vat" hint="Belgian format: BE 0xxx.xxx.xxx">
                    <Input id="vat" name="vatNumber" defaultValue={team.vatNumber ?? ""} placeholder="BE 0xxx.xxx.xxx" disabled={!canTransfer} autoComplete="off" />
                  </Field>
                  <Field label="KBO / Chamber of Commerce" id="kbo">
                    <Input id="kbo" name="kboNumber" defaultValue={team.kboNumber ?? ""} placeholder="0xxxxxxxxx" disabled={!canTransfer} autoComplete="off" />
                  </Field>
                  <Field label="IBAN" id="iban">
                    <Input id="iban" name="iban" defaultValue={team.iban ?? ""} placeholder="BE68 5390 0754 7034" disabled={!canTransfer} autoComplete="off" />
                  </Field>
                  <Field label="Billing email" id="bill-email" hint="Invoice delivery address">
                    <Input id="bill-email" name="billingEmail" type="email" defaultValue={team.billingEmail ?? ""} placeholder="billing@team.be" disabled={!canTransfer} autoComplete="off" />
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Billing phone" id="bill-phone">
                    <Input id="bill-phone" name="billingPhone" defaultValue={team.billingPhone ?? ""} placeholder="+32 …" disabled={!canTransfer} autoComplete="off" />
                  </Field>
                  <Field label="Default invoice recipient" id="client-type" hint="Fallback when creating assignments">
                    <Select id="client-type" name="defaultClientType" defaultValue={team.defaultClientType ?? ""} disabled={!canTransfer}>
                      <option value="">— Pick per assignment —</option>
                      <option value="owner">Property owner</option>
                      <option value="firm">Firm / agency</option>
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-[2fr_1fr_2fr_1fr]">
                  <Field label="Address" id="billing-address">
                    <Input id="billing-address" name="billingAddress" defaultValue={team.billingAddress ?? ""} placeholder="Street + number" disabled={!canTransfer} autoComplete="off" />
                  </Field>
                  <Field label="Postal" id="billing-postal">
                    <Input id="billing-postal" name="billingPostal" defaultValue={team.billingPostal ?? ""} placeholder="2000" disabled={!canTransfer} autoComplete="off" />
                  </Field>
                  <Field label="City" id="billing-city">
                    <Input id="billing-city" name="billingCity" defaultValue={team.billingCity ?? ""} placeholder="Antwerpen" disabled={!canTransfer} autoComplete="off" />
                  </Field>
                  <Field label="Country" id="billing-country">
                    <Input id="billing-country" name="billingCountry" defaultValue={team.billingCountry ?? "Belgium"} disabled={!canTransfer} autoComplete="off" />
                  </Field>
                </div>

                <Field label="Description / internal notes" id="description">
                  <Textarea
                    id="description"
                    name="description"
                    rows={3}
                    defaultValue={team.description ?? ""}
                    placeholder="Anything worth remembering about this team — primary contact, scheduling quirks, …"
                    disabled={!canTransfer}
                  />
                </Field>

                {canTransfer && (
                  <div className="flex justify-end pt-2">
                    <Button type="submit">Save billing details</Button>
                  </div>
                )}
              </CardBody>
            </form>
          </Card>
        </section>

        {/* ───── Branding ─────────────────────────────────────────── */}
        <section id="branding" className="scroll-mt-20">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Logo and signature used on PDF certificates issued on behalf of this team.
              </p>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">Team logo</p>
                  {logoImageUrl ? (
                    // Rendered via the /api/teams/:id/logo route; redirects to
                    // a presigned URL on S3, streams bytes on local.
                    <img
                      src={logoImageUrl}
                      alt={`${team.name} logo`}
                      className="h-28 w-28 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] object-contain p-2"
                    />
                  ) : (
                    <div className="grid h-28 w-28 place-items-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs text-[var(--color-ink-muted)]">
                      No logo
                    </div>
                  )}
                  <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
                    {canTransfer ? (
                      <Link href={`/dashboard/teams/${id}/edit#branding`} className="underline-offset-4 hover:underline">
                        Upload or replace in Edit →
                      </Link>
                    ) : (
                      <span>Shown on dashboards, assignments, and team cards.</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">Signature image</p>
                  {signatureImageUrl ? (
                    <img
                      src={signatureImageUrl}
                      alt={`${team.name} signature`}
                      className="h-20 w-56 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] object-contain p-2"
                    />
                  ) : (
                    <div className="grid h-20 w-56 place-items-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs text-[var(--color-ink-muted)]">
                      No signature
                    </div>
                  )}
                  <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
                    {canTransfer ? (
                      <Link href={`/dashboard/teams/${id}/edit#branding`} className="underline-offset-4 hover:underline">
                        Upload or replace in Edit →
                      </Link>
                    ) : (
                      <span>Stamped on certificates and signed assignment forms.</span>
                    )}
                  </p>
                </div>
              </div>

            </CardBody>
          </Card>
        </section>

        {/* ───── Services & pricing ──────────────────────────────── */}
        {/* v1 parity: per-team price overrides live under Admin\TeamController
            (admin-only). Realtors see no pricing UI in v1 — hide the whole
            section rather than render disabled inputs. */}
        {isAdmin && (
        <section id="services" className="scroll-mt-20">
          <Card>
            <CardHeader>
              <CardTitle>Services & price overrides</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Per-team prices override the master price list. Leave blank to use the
                master price shown.
              </p>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Service</th>
                    <th className="px-6 py-3 text-right font-semibold">Master</th>
                    <th className="px-6 py-3 text-right font-semibold">Team override</th>
                    <th className="px-6 py-3 text-right font-semibold">Effective</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {services.map((s) => {
                    const master = s.unitPrice / 100;
                    const override = overrideByKey[s.key];
                    const effective = override ?? s.unitPrice;
                    return (
                      <tr key={s.key}>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <ServicePill color={s.color} label={s.short} />
                            <span className="font-medium text-[var(--color-ink)]">
                              {s.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-[var(--color-ink-soft)] tabular-nums">
                          € {master.toFixed(2)}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-sm text-[var(--color-ink-muted)]">€</span>
                            <Input
                              type="number"
                              step="0.01"
                              defaultValue={override ? (override / 100).toFixed(2) : ""}
                              placeholder="—"
                              className="h-9 max-w-[140px]"
                              disabled={!isAdmin}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-semibold text-[var(--color-ink)] tabular-nums">
                          € {(effective / 100).toFixed(2)}
                          {override !== undefined && (
                            <span className="ml-1 text-[10px] font-medium text-[var(--color-epc)]">
                              (override)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </CardBody>
          </Card>
        </section>
        )}

        {/* ───── Commission ───────────────────────────────────────── */}
        {/* v1 parity: commission config + activity live on the admin team-edit
            page (Livewire TeamEdit.php:83-85, 116-117, 351-352). Non-admin
            users see no commission UI in v1 at all — no teams/*.blade.php
            references commission. Hide the whole section rather than show
            disabled. */}
        {isAdmin && (
        <section id="commission" className="scroll-mt-20">
          <Card>
            <CardHeader>
              <CardTitle>Commission configuration</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                How this team is rewarded per delivered assignment. Payouts are tracked
                on the{" "}
                <Link
                  href="/dashboard/commissions"
                  className="font-medium text-[var(--color-ink)] underline decoration-dotted underline-offset-2"
                >
                  Commissions page
                </Link>
                .
              </p>
            </CardHeader>
            <CardBody className="space-y-6">
              <fieldset className="grid gap-3 sm:grid-cols-3">
                <CommissionTypeOption
                  value=""
                  label="None"
                  description="This team doesn't earn commission."
                  checked={!team.commissionType}
                  disabled={!isAdmin}
                />
                <CommissionTypeOption
                  value="percentage"
                  label="Percentage"
                  description="A share of the assignment price."
                  checked={team.commissionType === "percentage"}
                  disabled={!isAdmin}
                />
                <CommissionTypeOption
                  value="fixed"
                  label="Fixed amount"
                  description="A flat fee per delivered assignment."
                  checked={team.commissionType === "fixed"}
                  disabled={!isAdmin}
                />
              </fieldset>

              {team.commissionType && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={team.commissionType === "percentage" ? "Percentage" : "Amount"}
                    id="commission-amount"
                    hint={
                      team.commissionType === "percentage"
                        ? "Of the invoice total, excluding VAT."
                        : "Flat euro amount per delivered assignment."
                    }
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        id="commission-amount"
                        type="number"
                        step={team.commissionType === "percentage" ? "0.1" : "0.01"}
                        defaultValue={
                          team.commissionType === "percentage"
                            ? ((team.commissionValue ?? 0) / 100).toFixed(1)
                            : ((team.commissionValue ?? 0) / 100).toFixed(2)
                        }
                        className="max-w-[180px]"
                        disabled={!isAdmin}
                      />
                      <span className="text-sm text-[var(--color-ink-muted)]">
                        {team.commissionType === "percentage" ? "%" : "€"}
                      </span>
                    </div>
                  </Field>
                  <Field label="Payout cadence" id="cadence">
                    <Select id="cadence" defaultValue="monthly" disabled={!isAdmin}>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                    </Select>
                  </Field>
                </div>
              )}

              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
                <p className="font-medium text-[var(--color-ink)]">Commission activity</p>
                {commissionActivity.length === 0 ? (
                  <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                    No commission accrued yet. Lines are recorded when an assignment
                    is marked completed.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-xs">
                    {commissionActivity.map((c) => (
                      <li key={c.key} className="flex items-baseline justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-[var(--color-ink-soft)]">
                          <span className="tabular-nums">{c.period}</span>
                          {c.status === "current" ? (
                            <span className="rounded-sm bg-[var(--color-bg-muted)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
                              Accruing
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-epc)]">
                              <IconCheck size={10} />
                              Paid {c.paidAt?.toISOString().slice(0, 10)}
                            </span>
                          )}
                        </span>
                        <span className="font-medium tabular-nums text-[var(--color-ink)]">
                          {formatEuros(c.amountCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>
        </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-6">
          {isAdmin ? (
            <DeleteTeamButton teamId={id} teamName={team.name} />
          ) : (
            <span className="text-xs text-[var(--color-ink-muted)]">
              Only admins can delete this team.
            </span>
          )}
          <Button href={`/dashboard/teams/${id}/edit`} size="md">
            <IconCheck size={14} />
            Edit team
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────

function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
        {label}
      </dt>
      <dd
        className={
          "mt-1 text-sm text-[var(--color-ink)] " + (mono ? "font-mono tabular-nums" : "")
        }
      >
        {value || <span className="text-[var(--color-ink-muted)] italic">Not set</span>}
      </dd>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md px-2 py-1.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      <IconArrowRight size={12} />
    </Link>
  );
}

function CommissionTypeOption({
  value,
  label,
  description,
  checked,
  disabled,
}: {
  value: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      className={
        "flex items-start gap-3 rounded-md border p-4 transition-colors " +
        (disabled ? "cursor-not-allowed opacity-60 " : "cursor-pointer ") +
        (checked
          ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/10 bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
          : "border-[var(--color-border-strong)] hover:border-[var(--color-brand)]")
      }
    >
      <input
        type="radio"
        name="commission-type"
        value={value}
        defaultChecked={checked}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
      />
      <div>
        <div className="text-sm font-medium text-[var(--color-ink)]">{label}</div>
        <div className="text-xs text-[var(--color-ink-muted)]">{description}</div>
      </div>
    </label>
  );
}
