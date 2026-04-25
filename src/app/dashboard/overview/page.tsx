import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ServicePill } from "@/components/ui/Badge";
import { HoverPrefetchLink } from "@/components/ui/HoverPrefetchLink";
import { StatCard } from "@/components/dashboard/StatCard";
import { IconChart, IconCheck } from "@/components/ui/Icons";
import { requireSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { formatEuros } from "@/lib/format";
import { SERVICES, type ServiceKey } from "@/lib/mockData";
import { loadFinancialOverview } from "@/lib/financial";
import { quarterlyTotalsByTeam } from "@/lib/commission";
import {
  MONTH_SHORT,
  QUARTERS,
  type Period,
  type PeriodKind,
  currentPeriod,
  parsePeriod,
  periodLabel,
} from "@/lib/period";
import { AdjustmentsCard } from "./AdjustmentsCard";
import { MarkPaidButton } from "@/app/dashboard/commissions/MarkPaidButton";
import { TeamFilter } from "./TeamFilter";
import { ByTeamSortHeader, type ByTeamSort } from "./ByTeamSortHeader";

type SearchParams = Promise<{
  period?: string;
  year?: string;
  month?: string;
  quarter?: string;
  team?: string;
  sort?: string;
  dir?: string;
}>;

const BY_TEAM_SORTS = ["team", "assignments", "revenue", "commission"] as const;
function isByTeamSort(x: string | undefined): x is ByTeamSort {
  return (BY_TEAM_SORTS as readonly string[]).includes(x ?? "");
}

function qs(p: Period): string {
  if (p.kind === "year") return `?period=year&year=${p.year}`;
  if (p.kind === "quarter") return `?period=quarter&year=${p.year}&quarter=${p.quarter}`;
  return `?period=month&year=${p.year}&month=${p.month}`;
}

/** Best-effort quarter to carry over when flipping tabs. */
function quarterFrom(p: Period, fallback: Period): number {
  if (p.kind === "quarter") return p.quarter;
  if (p.kind === "month") return Math.floor((p.month - 1) / 3) + 1;
  if (fallback.kind === "quarter") return fallback.quarter;
  if (fallback.kind === "month") return Math.floor((fallback.month - 1) / 3) + 1;
  return 1;
}

/** Best-effort month to carry over when flipping tabs. */
function monthFrom(p: Period, fallback: Period): number {
  if (p.kind === "month") return p.month;
  if (p.kind === "quarter") return (p.quarter - 1) * 3 + 1;
  if (fallback.kind === "month") return fallback.month;
  if (fallback.kind === "quarter") return (fallback.quarter - 1) * 3 + 1;
  return 1;
}

export const metadata = { title: "Overview" };

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  // Admin only — Platform's /overview route group is role:admin.
  if (!hasRole(session, "admin")) {
    redirect("/no-access?section=revenue");
  }

  const params = await searchParams;
  const period = parsePeriod(params);
  const teamId = (params.team ?? "").trim() || null;
  const sort: ByTeamSort = isByTeamSort(params.sort) ? params.sort : "revenue";
  const dir: "asc" | "desc" = params.dir === "asc" ? "asc" : "desc";

  // Per-team quarterly payout state — only makes sense in quarter view.
  // Loaded in parallel with the snapshot to keep the page single-RTT.
  const [snapshot, quarterTotals] = await Promise.all([
    loadFinancialOverview(period, { teamId }),
    period.kind === "quarter"
      ? quarterlyTotalsByTeam(period.year, period.quarter)
      : Promise.resolve([]),
  ]);

  const now = currentPeriod("month");
  const yearOptions = [now.year + 1, now.year, now.year - 1, now.year - 2];
  const { totals, byTeam, byService, byMonth, adjustments, allTeams } = snapshot;
  const outstanding = totals.commissionAccruedCents - totals.commissionPaidCents;

  // financial.ts already narrows every query to the selected team, so byTeam
  // is already scoped. Apply the URL's sort/dir on top. Team-name tie-breaker
  // keeps the order deterministic when the primary key ties (e.g. two teams
  // with equal assignment counts).
  const sortedByTeam = [...byTeam].sort((a, b) => {
    const mul = dir === "asc" ? 1 : -1;
    const tiebreak = a.teamName.localeCompare(b.teamName);
    if (sort === "team") return mul * tiebreak;
    if (sort === "assignments") return mul * (a.assignmentCount - b.assignmentCount) || tiebreak;
    if (sort === "commission") return mul * (a.commissionAccruedCents - b.commissionAccruedCents) || tiebreak;
    return mul * (a.revenueCents - b.revenueCents) || tiebreak;
  });

  // Quarter view — which teams have a payout row already? We key by teamId.
  const payoutByTeam = new Map(quarterTotals.map((q) => [q.teamId, q]));

  const defaultAdjMonth =
    period.kind === "month"
      ? period.month
      : period.kind === "quarter"
        ? (period.quarter - 1) * 3 + 1
        : 1;

  return (
    <>
      <Topbar title="Revenue overview" subtitle={periodLabel(period)} />

      <div className="p-8 max-w-[1400px] space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <PeriodTabs period={period} now={now} />
          <YearPicker period={period} years={yearOptions} />
          {period.kind === "quarter" && <QuarterPicker period={period} />}
          {period.kind === "month" && <MonthPicker period={period} />}
          <TeamFilter value={teamId ?? ""} teams={allTeams} />
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard
            label="Revenue"
            value={formatEuros(totals.revenueCents)}
            hint={
              totals.adjustmentCents !== 0
                ? `${totals.assignmentCount} completed · ${formatEuros(totals.adjustmentCents)} adj`
                : `${totals.assignmentCount} completed`
            }
          />
          <StatCard
            label="Commission accrued"
            value={formatEuros(totals.commissionAccruedCents)}
            hint="Across eligible teams"
          />
          <StatCard
            label="Commission paid"
            value={formatEuros(totals.commissionPaidCents)}
            hint="Payouts dated in period"
            tone="ok"
          />
          <StatCard
            label="Outstanding"
            value={formatEuros(outstanding)}
            hint="Accrued minus paid"
            tone={outstanding > 0 ? "warn" : "neutral"}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <RevenueBarChart months={byMonth} className="lg:col-span-2" />
          <ByServiceCard byService={byService} total={totals.revenueCents} />
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>By team</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Revenue, commission earned, and payouts for {periodLabel(period)}.
              </p>
            </div>
            <Link
              href={`/dashboard/commissions${period.kind === "quarter" ? `?year=${period.year}&quarter=${period.quarter}` : ""}`}
              className="text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            >
              Manage payouts →
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            {sortedByTeam.length === 0 ? (
              <EmptyState
                variant="dashed"
                icon={<IconChart size={22} />}
                title={`No revenue booked in ${periodLabel(period)}`}
                description={
                  teamId
                    ? "No revenue for that team in this period. Try removing the team filter or switching period."
                    : "Revenue is booked when an assignment reaches 'completed'. Nothing completed yet this period."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                      <ByTeamSortHeader id="team" label="Team" currentSort={sort} currentDir={dir} />
                      <ByTeamSortHeader id="assignments" label="Assignments" currentSort={sort} currentDir={dir} align="right" />
                      <ByTeamSortHeader id="revenue" label="Revenue" currentSort={sort} currentDir={dir} align="right" />
                      <ByTeamSortHeader id="commission" label="Commission" currentSort={sort} currentDir={dir} align="right" />
                      <th className="px-6 py-3 text-right font-semibold">Paid</th>
                      <th className="px-6 py-3 text-left font-semibold">Status</th>
                      {period.kind === "quarter" && (
                        <th className="px-6 py-3 text-right font-semibold">Payout</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {sortedByTeam.map((row) => {
                      const fullyPaid =
                        row.commissionAccruedCents > 0 &&
                        row.commissionPaidCents >= row.commissionAccruedCents;
                      const partial =
                        row.commissionPaidCents > 0 &&
                        row.commissionPaidCents < row.commissionAccruedCents;
                      const quarterPayout =
                        period.kind === "quarter" ? payoutByTeam.get(row.teamId) : null;
                      return (
                        <tr key={row.teamId} className="hover:bg-[var(--color-bg-alt)]">
                          <td className="px-6 py-3">
                            <Link
                              href={`/dashboard/teams/${row.teamId}#commission`}
                              className="font-medium text-[var(--color-ink)] hover:underline"
                            >
                              {row.teamName}
                            </Link>
                            {row.teamCity && (
                              <span className="ml-2 text-xs text-[var(--color-ink-muted)]">
                                {row.teamCity}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-right text-[var(--color-ink-soft)] tabular-nums">
                            {row.assignmentCount}
                          </td>
                          <td className="px-6 py-3 text-right font-medium text-[var(--color-ink)] tabular-nums">
                            {formatEuros(row.revenueCents)}
                          </td>
                          <td className="px-6 py-3 text-right text-[var(--color-ink-soft)] tabular-nums">
                            {formatEuros(row.commissionAccruedCents)}
                          </td>
                          <td className="px-6 py-3 text-right text-[var(--color-ink-soft)] tabular-nums">
                            {formatEuros(row.commissionPaidCents)}
                          </td>
                          <td className="px-6 py-3">
                            {row.commissionAccruedCents === 0 && row.commissionPaidCents === 0 ? (
                              <span className="text-xs text-[var(--color-ink-muted)]">No commission</span>
                            ) : fullyPaid ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-epc)]">
                                <IconCheck size={12} />
                                Paid
                              </span>
                            ) : partial ? (
                              <span className="text-xs text-[var(--color-electrical)]">Partial</span>
                            ) : (
                              <span className="text-xs text-[var(--color-ink-muted)]">Outstanding</span>
                            )}
                          </td>
                          {period.kind === "quarter" && (
                            <td className="px-6 py-3 text-right">
                              {/* Show mark-paid only when there's actually commission accrued
                                  for the quarter; otherwise the quarter has nothing to pay out. */}
                              {row.commissionAccruedCents > 0 ? (
                                <MarkPaidButton
                                  teamId={row.teamId}
                                  year={period.year}
                                  quarter={period.quarter}
                                  isPaid={!!quarterPayout?.payout}
                                />
                              ) : (
                                <span className="text-xs text-[var(--color-ink-muted)]">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <AdjustmentsCard
          adjustments={adjustments}
          teams={allTeams}
          defaultYear={period.year}
          defaultMonth={defaultAdjMonth}
          periodLabel={periodLabel(period)}
        />
      </div>
    </>
  );
}

// ─── Period picker subcomponents ─────────────────────────────────────

function PeriodTabs({ period, now }: { period: Period; now: Period }) {
  const kinds: Array<{ id: PeriodKind; label: string }> = [
    { id: "month", label: "Month" },
    { id: "quarter", label: "Quarter" },
    { id: "year", label: "Year" },
  ];
  return (
    <div className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5">
      {kinds.map((k) => {
        const active = period.kind === k.id;
        const target: Period =
          k.id === "year"
            ? { kind: "year", year: period.year }
            : k.id === "quarter"
              ? { kind: "quarter", year: period.year, quarter: quarterFrom(period, now) }
              : { kind: "month", year: period.year, month: monthFrom(period, now) };
        return (
          <HoverPrefetchLink
            key={k.id}
            href={qs(target)}
            className={
              "inline-flex h-8 items-center rounded px-3 text-sm " +
              (active
                ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]")
            }
          >
            {k.label}
          </HoverPrefetchLink>
        );
      })}
    </div>
  );
}

function YearPicker({ period, years }: { period: Period; years: number[] }) {
  return (
    <div className="flex items-center gap-1">
      {years.map((y) => {
        const target: Period =
          period.kind === "year"
            ? { kind: "year", year: y }
            : period.kind === "quarter"
              ? { kind: "quarter", year: y, quarter: period.quarter }
              : { kind: "month", year: y, month: period.month };
        const active = y === period.year;
        return (
          <HoverPrefetchLink
            key={y}
            href={qs(target)}
            className={
              "inline-flex h-8 items-center rounded-md px-3 text-sm " +
              (active
                ? "border border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] font-medium text-[var(--color-ink)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]")
            }
          >
            {y}
          </HoverPrefetchLink>
        );
      })}
    </div>
  );
}

function QuarterPicker({ period }: { period: Extract<Period, { kind: "quarter" }> }) {
  return (
    <div className="flex items-center gap-1">
      {QUARTERS.map((q) => {
        const active = q === period.quarter;
        return (
          <HoverPrefetchLink
            key={q}
            href={qs({ kind: "quarter", year: period.year, quarter: q })}
            className={
              "inline-flex h-8 items-center rounded-md px-3 text-sm " +
              (active
                ? "border border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] font-medium text-[var(--color-ink)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]")
            }
          >
            Q{q}
          </HoverPrefetchLink>
        );
      })}
    </div>
  );
}

function MonthPicker({ period }: { period: Extract<Period, { kind: "month" }> }) {
  return (
    <div className="flex items-center gap-0.5">
      {MONTH_SHORT.map((label, i) => {
        const m = i + 1;
        const active = m === period.month;
        return (
          <HoverPrefetchLink
            key={label}
            href={qs({ kind: "month", year: period.year, month: m })}
            className={
              "inline-flex h-8 items-center rounded-md px-2.5 text-xs " +
              (active
                ? "border border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] font-medium text-[var(--color-ink)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]")
            }
          >
            {label}
          </HoverPrefetchLink>
        );
      })}
    </div>
  );
}

// ─── Chart + by-service ──────────────────────────────────────────────

function RevenueBarChart({
  months,
  className,
}: {
  months: Array<{ year: number; month: number; label: string; revenueCents: number }>;
  className?: string;
}) {
  const peak = Math.max(0, ...months.map((m) => m.revenueCents));
  // Round ceiling up to a tidy 5_000 € step so y-axis gridlines land on round numbers.
  const stepCents = 500_000;
  const ceilingCents = Math.max(stepCents, Math.ceil(peak / stepCents) * stepCents);
  const ticks = [1, 0.75, 0.5, 0.25, 0];

  return (
    <Card className={"p-6 " + (className ?? "")}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Revenue by month</h2>
        <p className="text-xs text-[var(--color-ink-muted)]">{months.length} months</p>
      </div>
      <div className="mt-8 flex gap-4">
        <div className="flex h-56 flex-col justify-between pb-8 text-right text-[10px] tabular-nums text-[var(--color-ink-muted)]">
          {ticks.map((t) => (
            <span key={t}>€ {((ceilingCents * t) / 100_000).toFixed(0)}k</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-0 h-48 flex flex-col justify-between">
            {ticks.map((t, i) => (
              <div
                key={t}
                className={
                  "h-px w-full " +
                  (i === ticks.length - 1
                    ? "bg-[var(--color-border-strong)]"
                    : "bg-[var(--color-border)]")
                }
              />
            ))}
          </div>
          <div
            className="relative h-48 grid gap-3"
            style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
          >
            {months.map((m) => {
              const h = ceilingCents === 0 ? 0 : (m.revenueCents / ceilingCents) * 100;
              const isPeak = peak > 0 && m.revenueCents === peak;
              return (
                <div
                  key={`${m.year}-${m.month}`}
                  className="group relative flex h-full flex-col items-center justify-end"
                >
                  <p className="mb-2 text-[10px] font-medium text-[var(--color-ink)] tabular-nums">
                    {m.revenueCents === 0 ? "—" : formatEuros(m.revenueCents).replace(/\.00$/, "")}
                  </p>
                  <div
                    className={
                      "relative w-full max-w-14 rounded-t-md transition-all " +
                      (isPeak
                        ? "bg-[var(--color-brand)] group-hover:opacity-80"
                        : "bg-[var(--color-border-strong)] group-hover:bg-[var(--color-ink-muted)]")
                    }
                    style={{ height: `${h}%`, minHeight: h > 0 ? 4 : 0 }}
                    title={formatEuros(m.revenueCents)}
                  />
                </div>
              );
            })}
          </div>
          <div
            className="mt-3 grid gap-3 text-center text-xs text-[var(--color-ink-muted)]"
            style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
          >
            {months.map((m) => (
              <span key={`${m.year}-${m.month}`}>{m.label}</span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ByServiceCard({
  byService,
  total,
}: {
  byService: Array<{ serviceKey: string; revenueCents: number }>;
  total: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>By service</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {byService.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">No service revenue in this period.</p>
        ) : (
          byService.map((s) => {
            const svc = SERVICES[s.serviceKey as ServiceKey];
            const pct = total > 0 ? Math.round((s.revenueCents / total) * 100) : 0;
            return (
              <div key={s.serviceKey}>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {svc ? (
                      <ServicePill color={svc.color} label={svc.short} />
                    ) : (
                      <span className="text-xs font-medium uppercase text-[var(--color-ink-soft)]">
                        {s.serviceKey}
                      </span>
                    )}
                    <span className="text-[var(--color-ink-soft)]">{svc?.label ?? s.serviceKey}</span>
                  </div>
                  <span className="font-medium text-[var(--color-ink)] tabular-nums">
                    {formatEuros(s.revenueCents)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: svc?.color ?? "var(--color-ink-muted)" }}
                  />
                </div>
              </div>
            );
          })
        )}
        <div className="flex items-baseline justify-between border-t border-[var(--color-border)] pt-4">
          <span className="text-sm text-[var(--color-ink-muted)]">Total</span>
          <span className="text-xl font-semibold tabular-nums">{formatEuros(total)}</span>
        </div>
      </CardBody>
    </Card>
  );
}
