import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChart, IconCheck } from "@/components/ui/Icons";
import { requireSession } from "@/lib/auth";
import { canMarkCommissionPaid, hasRole } from "@/lib/permissions";
import { formatCommissionRate, formatEuros } from "@/lib/format";
import {
  quarterOf,
  quarterlyTotalsByTeam,
  teamQuarterLines,
} from "@/lib/commission";
import { MarkPaidButton } from "./MarkPaidButton";

const QUARTERS = [1, 2, 3, 4] as const;

type SearchParams = Promise<{ year?: string; quarter?: string; team?: string }>;

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  // Admin only — Platform's /overview route group is role:admin. Team
  // owners see their own team's accrual on the team detail page.
  if (!hasRole(session, "admin")) {
    redirect("/no-access?section=commissions");
  }

  const params = await searchParams;
  const now = new Date();
  const current = quarterOf(now);
  const year = Number.parseInt(params.year ?? "", 10) || current.year;
  const quarter =
    [1, 2, 3, 4].includes(Number.parseInt(params.quarter ?? "", 10))
      ? (Number.parseInt(params.quarter ?? "", 10) as 1 | 2 | 3 | 4)
      : (current.quarter as 1 | 2 | 3 | 4);
  const drilldownTeamId = params.team;

  const [totals, lines] = await Promise.all([
    quarterlyTotalsByTeam(year, quarter),
    drilldownTeamId
      ? teamQuarterLines(drilldownTeamId, year, quarter)
      : Promise.resolve([]),
  ]);

  const grandTotal = totals.reduce((s, r) => s + r.totalCents, 0);
  // Use the payout's snapshot amount, not the current accrual — the two can
  // drift if a commission line gets recomputed after mark-paid, and the
  // "Paid out" tile should reflect what was actually paid.
  const paidTotal = totals.reduce(
    (s, r) => s + (r.payout ? r.payout.amountCents : 0),
    0,
  );
  const canMark = canMarkCommissionPaid(session);

  const yearOptions = [current.year + 1, current.year, current.year - 1, current.year - 2];

  return (
    <>
      <Topbar
        title="Commissions"
        subtitle={`${year} · Q${quarter} · ${formatEuros(grandTotal)} total`}
      />

      <div className="p-8 max-w-[1200px] space-y-6">
        {/* Year + quarter picker — server-rendered state via ?year&quarter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
              Year
            </span>
            {yearOptions.map((y) => (
              <Link
                key={y}
                href={`?year=${y}&quarter=${quarter}`}
                className={
                  "inline-flex h-8 items-center rounded-md px-3 text-sm " +
                  (y === year
                    ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                    : "border border-[var(--color-border-strong)] text-[var(--color-ink)] hover:border-[var(--color-ink-soft)]")
                }
              >
                {y}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
              Quarter
            </span>
            {QUARTERS.map((q) => (
              <Link
                key={q}
                href={`?year=${year}&quarter=${q}`}
                className={
                  "inline-flex h-8 items-center rounded-md px-3 text-sm " +
                  (q === quarter
                    ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                    : "border border-[var(--color-border-strong)] text-[var(--color-ink)] hover:border-[var(--color-ink-soft)]")
                }
              >
                Q{q}
              </Link>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-6">
            <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
              Accrued this quarter
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--color-ink)]">
              {formatEuros(grandTotal)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              Across {totals.length} team{totals.length === 1 ? "" : "s"}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
              Paid out
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--color-ink)]">
              {formatEuros(paidTotal)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              {totals.filter((r) => r.payout).length} of {totals.length} teams paid
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
              Outstanding
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--color-ink)]">
              {formatEuros(grandTotal - paidTotal)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              Pending payout confirmation
            </p>
          </Card>
        </div>

        {/* Per-team table */}
        <Card>
          <CardHeader>
            <CardTitle>Teams</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Click a row to see the per-assignment breakdown for that team.
            </p>
          </CardHeader>
          <CardBody className="p-0">
            {totals.length === 0 ? (
              <EmptyState
                variant="dashed"
                icon={<IconChart size={22} />}
                title={`No commissions for Q${quarter} ${year} yet`}
                description="Commission lines fire when an assignment reaches 'completed'. Nothing completed this quarter yet — or no completed work had an asbestos service."
              />
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    <th className="px-6 py-3 text-left font-semibold">Team</th>
                    <th className="px-6 py-3 text-left font-semibold">Lines</th>
                    <th className="px-6 py-3 text-right font-semibold">Total</th>
                    <th className="px-6 py-3 text-left font-semibold">Status</th>
                    <th className="px-6 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {totals.map((row) => {
                    const isDrilled = row.teamId === drilldownTeamId;
                    return (
                      <tr
                        key={row.teamId}
                        className={
                          isDrilled
                            ? "bg-[var(--color-bg-alt)]"
                            : "transition-colors hover:bg-[var(--color-bg-alt)]"
                        }
                      >
                        <td className="px-6 py-3">
                          <Link
                            href={`?year=${year}&quarter=${quarter}&team=${isDrilled ? "" : row.teamId}`}
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
                        <td className="px-6 py-3 text-[var(--color-ink-soft)] tabular-nums">
                          {row.lineCount}
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-[var(--color-ink)] tabular-nums">
                          {formatEuros(row.totalCents)}
                        </td>
                        <td className="px-6 py-3">
                          {row.payout ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-epc)]">
                              <IconCheck size={12} />
                              Paid {row.payout.paidAt.toISOString().slice(0, 10)}
                              {row.payout.paidByName && (
                                <span className="text-[var(--color-ink-muted)]">
                                  by {row.payout.paidByName}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--color-ink-muted)]">Outstanding</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {canMark && (
                            <MarkPaidButton
                              teamId={row.teamId}
                              year={year}
                              quarter={quarter}
                              isPaid={!!row.payout}
                            />
                          )}
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

        {/* Drill-in: per-assignment breakdown for one team */}
        {drilldownTeamId && lines.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Breakdown</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Every commission line for{" "}
                {totals.find((t) => t.teamId === drilldownTeamId)?.teamName} in Q{quarter} {year}.
              </p>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    <th className="px-6 py-3 text-left font-semibold">Assignment</th>
                    <th className="px-6 py-3 text-left font-semibold">Property</th>
                    <th className="px-6 py-3 text-right font-semibold">Total</th>
                    <th className="px-6 py-3 text-left font-semibold">Rate</th>
                    <th className="px-6 py-3 text-right font-semibold">Commission</th>
                    <th className="px-6 py-3 text-left font-semibold">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {lines.map((l) => {
                    const rate = formatCommissionRate(l.commissionType, l.commissionValue);
                    return (
                      <tr key={l.id} className="hover:bg-[var(--color-bg-alt)]">
                        <td className="px-6 py-3">
                          <Link
                            href={`/dashboard/assignments/${l.assignment.id}`}
                            className="font-mono text-xs font-medium text-[var(--color-ink)] hover:underline"
                          >
                            {l.assignment.reference}
                          </Link>
                        </td>
                        <td className="px-6 py-3">
                          <p className="text-sm text-[var(--color-ink)]">
                            {l.assignment.address}
                          </p>
                          <p className="text-xs text-[var(--color-ink-muted)]">
                            {l.assignment.postal} {l.assignment.city}
                          </p>
                        </td>
                        <td className="px-6 py-3 text-right text-[var(--color-ink-soft)] tabular-nums">
                          {formatEuros(l.assignmentTotalCents)}
                        </td>
                        <td className="px-6 py-3 text-[var(--color-ink-soft)]">{rate}</td>
                        <td className="px-6 py-3 text-right font-medium text-[var(--color-ink)] tabular-nums">
                          {formatEuros(l.commissionAmountCents)}
                        </td>
                        <td className="px-6 py-3 text-xs text-[var(--color-ink-muted)] tabular-nums">
                          {l.computedAt.toISOString().slice(0, 10)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
