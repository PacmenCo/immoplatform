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

function initials(first: string, last: string): string {
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "??";
}

function euros(cents: number): string {
  return `€ ${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const roleBadge: Record<string, { bg: string; fg: string }> = {
  admin: { bg: "#fef2f2", fg: "#b91c1c" },
  staff: { bg: "#f5f3ff", fg: "#6d28d9" },
  realtor: { bg: "#eff6ff", fg: "#1d4ed8" },
  freelancer: { bg: "#ecfdf5", fg: "#047857" },
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "members", label: "Members" },
  { id: "assignments", label: "Assignments" },
  { id: "billing", label: "Billing" },
  { id: "branding", label: "Branding" },
  { id: "services", label: "Services & pricing" },
  { id: "commission", label: "Commission" },
];

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const period = monthStart.toISOString().slice(0, 7); // YYYY-MM

  const [team, services, recentCommissions] = await Promise.all([
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
    // Commission history for the team (when we have the table wired)
    // For now this is a silent no-op since CommissionLine isn't in Prisma yet.
    Promise.resolve<
      Array<{
        id: string;
        period: string;
        commissionAmount: number;
        status: string;
      }>
    >([]),
  ]);

  if (!team) notFound();

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
      ? `${((team.commissionValue ?? 0) / 100).toFixed(1)}% of revenue`
      : `${euros(team.commissionValue ?? 0)} flat fee`
    : "Not configured";

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
              <Button href="/dashboard/users/invite" variant="secondary" size="sm">
                <IconPlus size={14} />
                Invite member
              </Button>
              <Button size="sm">
                <IconCheck size={14} />
                Save changes
              </Button>
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
          {TABS.map((t, i) => (
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
                            href={`/dashboard/assignments/${a.id}`}
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
                <QuickLink
                  href="/dashboard/users/invite"
                  icon={<IconMail size={14} />}
                  label="Invite member"
                />
                <QuickLink href="#billing" icon={<IconFileText size={14} />} label="Edit billing details" />
                <QuickLink
                  href="#commission"
                  icon={<IconBuilding size={14} />}
                  label="Adjust commission"
                />
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
              <Button href="/dashboard/users/invite" size="sm">
                <IconPlus size={14} />
                Invite member
              </Button>
            </CardHeader>
            <CardBody className="p-0">
              {team.members.length === 0 ? (
                <div className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
                  No members yet. Invite someone to get started.
                </div>
              ) : (
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
                      const rb = roleBadge[m.user.role] ?? roleBadge.freelancer;
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
                            <Button variant="ghost" size="sm">
                              Manage
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                              href={`/dashboard/assignments/${a.id}`}
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
              )}
            </CardBody>
          </Card>
        </section>

        {/* ───── Billing ──────────────────────────────────────────── */}
        <section id="billing" className="scroll-mt-20">
          <Card>
            <CardHeader>
              <CardTitle>Billing & legal</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Legal entity details for invoices issued to and from this team.
              </p>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Legal name" id="legal-name" hint="Official entity name on invoices">
                  <Input id="legal-name" defaultValue={team.legalName ?? ""} placeholder="e.g. Vastgoed Antwerp BVBA" />
                </Field>
                <Field label="Contact email" id="team-email" hint="Team-wide inbox for notifications">
                  <Input id="team-email" type="email" defaultValue={team.email ?? ""} placeholder="contact@team.be" />
                </Field>
                <Field label="VAT number" id="vat" hint="Belgian format: BE 0xxx.xxx.xxx">
                  <Input id="vat" defaultValue={team.vatNumber ?? ""} placeholder="BE 0xxx.xxx.xxx" />
                </Field>
                <Field label="KBO / Chamber of Commerce" id="kbo">
                  <Input id="kbo" defaultValue={team.kboNumber ?? ""} placeholder="0xxxxxxxxx" />
                </Field>
                <Field label="IBAN" id="iban">
                  <Input id="iban" defaultValue={team.iban ?? ""} placeholder="BE68 5390 0754 7034" />
                </Field>
                <Field label="Billing email" id="bill-email" hint="Invoice delivery address">
                  <Input id="bill-email" type="email" defaultValue={team.billingEmail ?? ""} placeholder="billing@team.be" />
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Billing phone" id="bill-phone">
                  <Input id="bill-phone" defaultValue={team.billingPhone ?? ""} placeholder="+32 …" />
                </Field>
                <Field label="Default invoice recipient" id="client-type" hint="Fallback when creating assignments">
                  <Select id="client-type" defaultValue={team.defaultClientType ?? ""}>
                    <option value="">— Pick per assignment —</option>
                    <option value="owner">Property owner</option>
                    <option value="firm">Firm / agency</option>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-[2fr_1fr_2fr_1fr]">
                <Field label="Address" id="billing-address">
                  <Input id="billing-address" defaultValue={team.billingAddress ?? ""} placeholder="Street + number" />
                </Field>
                <Field label="Postal" id="billing-postal">
                  <Input id="billing-postal" defaultValue={team.billingPostal ?? ""} placeholder="2000" />
                </Field>
                <Field label="City" id="billing-city">
                  <Input id="billing-city" defaultValue={team.billingCity ?? ""} placeholder="Antwerpen" />
                </Field>
                <Field label="Country" id="billing-country">
                  <Input id="billing-country" defaultValue={team.billingCountry ?? "Belgium"} />
                </Field>
              </div>

              <Field label="Description / internal notes" id="description">
                <Textarea
                  id="description"
                  rows={3}
                  defaultValue={team.description ?? ""}
                  placeholder="Anything worth remembering about this team — primary contact, scheduling quirks, …"
                />
              </Field>
            </CardBody>
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
                <Field label="Team logo" hint="PNG or SVG, square, min 256px">
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] p-8 text-center transition-colors hover:border-[var(--color-brand)]">
                    <span
                      className="grid h-14 w-14 place-items-center rounded-md text-base font-bold text-white"
                      style={{ backgroundColor: team.logoColor ?? "#0f172a" }}
                    >
                      {team.logo ?? "??"}
                    </span>
                    <span className="text-sm text-[var(--color-ink-soft)]">
                      {team.logoUrl ? "Replace logo" : "Drop logo here or click to upload"}
                    </span>
                    <input type="file" accept="image/*" className="hidden" />
                  </label>
                </Field>
                <Field label="Signature image" hint="Used on certificates, transparent background preferred">
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] p-8 text-center transition-colors hover:border-[var(--color-brand)]">
                    <span className="font-serif italic text-2xl text-[var(--color-ink-soft)]">
                      {team.name.split(" ")[0]}
                    </span>
                    <span className="text-sm text-[var(--color-ink-soft)]">
                      {team.signatureUrl ? "Replace signature" : "Drop signature PNG here"}
                    </span>
                    <input type="file" accept="image/*" className="hidden" />
                  </label>
                </Field>
              </div>

              <label className="flex items-start justify-between gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">
                    Stamp logo on exported photos
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                    When freelancers upload property photos for this team&apos;s assignments,
                    the team logo gets overlaid in the bottom-right corner before export.
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked={team.prefersLogoOnPhotos}
                  className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                />
              </label>
            </CardBody>
          </Card>
        </section>

        {/* ───── Services & pricing ──────────────────────────────── */}
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
            </CardBody>
          </Card>
        </section>

        {/* ───── Commission ───────────────────────────────────────── */}
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
                />
                <CommissionTypeOption
                  value="percentage"
                  label="Percentage"
                  description="A share of the assignment price."
                  checked={team.commissionType === "percentage"}
                />
                <CommissionTypeOption
                  value="fixed"
                  label="Fixed amount"
                  description="A flat fee per delivered assignment."
                  checked={team.commissionType === "fixed"}
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
                      />
                      <span className="text-sm text-[var(--color-ink-muted)]">
                        {team.commissionType === "percentage" ? "%" : "€"}
                      </span>
                    </div>
                  </Field>
                  <Field label="Payout cadence" id="cadence">
                    <Select id="cadence" defaultValue="monthly">
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                    </Select>
                  </Field>
                </div>
              )}

              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
                <p className="font-medium text-[var(--color-ink)]">Most recent payouts</p>
                {recentCommissions.length === 0 ? (
                  <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                    No payouts recorded yet. Once the commission system is wired to the
                    database, the last three periods appear here.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs">
                    {recentCommissions.map((c) => (
                      <li key={c.id} className="flex justify-between">
                        <span className="tabular-nums text-[var(--color-ink-soft)]">
                          {c.period}
                        </span>
                        <span className="font-medium tabular-nums text-[var(--color-ink)]">
                          {euros(c.commissionAmount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>
        </section>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-6">
          <Button variant="danger" size="sm">
            Archive team
          </Button>
          <Button size="md">
            <IconCheck size={14} />
            Save changes
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────

function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  const dot =
    tone === "ok"
      ? "var(--color-epc)"
      : tone === "warn"
        ? "#f59e0b"
        : "var(--color-ink-muted)";
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-ink)] tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{hint}</p>}
    </Card>
  );
}

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
}: {
  value: string;
  label: string;
  description: string;
  checked: boolean;
}) {
  return (
    <label
      className={
        "flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors " +
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
        className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
      />
      <div>
        <div className="text-sm font-medium text-[var(--color-ink)]">{label}</div>
        <div className="text-xs text-[var(--color-ink-muted)]">{description}</div>
      </div>
    </label>
  );
}
