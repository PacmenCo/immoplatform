import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  IconArrowRight,
  IconCheck,
  IconFilter,
} from "@/components/ui/Icons";
import {
  COMMISSIONS,
  TEAMS,
  CommissionStatus,
} from "@/lib/mockData";

const STATUS_META: Record<CommissionStatus, { label: string; bg: string; fg: string; dot: string }> = {
  pending: { label: "Pending", bg: "#fef3c7", fg: "#b45309", dot: "#f59e0b" },
  approved: { label: "Approved", bg: "#dbeafe", fg: "#1d4ed8", dot: "#3b82f6" },
  paid: { label: "Paid", bg: "#dcfce7", fg: "#15803d", dot: "#10b981" },
  on_hold: { label: "On hold", bg: "#fef2f2", fg: "#b91c1c", dot: "#ef4444" },
};

const period = "2026-04";

export default function CommissionsPage() {
  const periodLines = COMMISSIONS.filter((c) => c.period === period);

  const totalOwed = periodLines
    .filter((c) => c.status !== "paid")
    .reduce((s, c) => s + c.commissionAmount, 0);
  const totalPaid = periodLines
    .filter((c) => c.status === "paid")
    .reduce((s, c) => s + c.commissionAmount, 0);
  const totalPending = periodLines.filter((c) => c.status === "pending").length;
  const teamsAwaiting = periodLines.filter((c) => c.status !== "paid").length;

  return (
    <>
      <Topbar title="Commissions" subtitle="Per-team payouts and rules" />

      <div className="p-8 max-w-[1400px] space-y-6">
        {/* Period + filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {["April 2026", "March 2026", "February 2026", "Q1 2026", "Year 2026"].map((p, i) => (
              <button
                key={p}
                className={
                  i === 0
                    ? "rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-1.5 text-sm font-medium"
                    : "rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                }
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">
              <IconFilter size={14} />
              Filter
            </Button>
            <Button variant="secondary" size="sm">
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-4">
          <SummaryStat label="Total owed" value={`€ ${totalOwed.toLocaleString()}`} tone="strong" hint={`${teamsAwaiting} team${teamsAwaiting === 1 ? "" : "s"} awaiting payout`} />
          <SummaryStat label="Paid (MTD)" value={`€ ${totalPaid.toLocaleString()}`} tone="ok" hint={`${periodLines.filter((c) => c.status === "paid").length} payouts`} />
          <SummaryStat label="Pending approval" value={totalPending.toString()} tone="warn" hint="Review & approve to release" />
          <SummaryStat label="On hold" value={periodLines.filter((c) => c.status === "on_hold").length.toString()} tone="danger" hint="Blocked — needs attention" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--color-border)]">
          <Tab label="Owed" count={periodLines.filter((c) => c.status !== "paid").length} active />
          <Tab label="Paid" count={periodLines.filter((c) => c.status === "paid").length} />
          <Tab label="Rules" count={TEAMS.length} />
        </div>

        {/* Bulk action bar */}
        <div className="flex items-center justify-between rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] px-4 py-2.5 text-sm">
          <div className="flex items-center gap-3">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" aria-label="Select all" />
            <span className="text-[var(--color-ink-soft)]">
              Select rows to approve or mark paid in bulk
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled>
              Approve
            </Button>
            <Button variant="secondary" size="sm" disabled>
              <IconCheck size={14} />
              Mark paid…
            </Button>
          </div>
        </div>

        {/* Main table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <th className="px-6 py-3 text-left w-8">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" aria-label="Select all rows" />
                  </th>
                  <th className="px-6 py-3 text-left font-semibold">Team</th>
                  <th className="px-6 py-3 text-right font-semibold">Assignments</th>
                  <th className="px-6 py-3 text-right font-semibold">Gross revenue</th>
                  <th className="px-6 py-3 text-right font-semibold">Rate</th>
                  <th className="px-6 py-3 text-right font-semibold">Commission</th>
                  <th className="px-6 py-3 text-left font-semibold">Status</th>
                  <th className="px-6 py-3 text-right font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {periodLines.map((c) => {
                  const team = TEAMS.find((t) => t.id === c.teamId);
                  const meta = STATUS_META[c.status];
                  return (
                    <tr
                      key={c.id}
                      className="transition-colors hover:bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
                    >
                      <td className="px-6 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--color-brand)]"
                          aria-label={`Select ${team?.name ?? c.teamId}`}
                        />
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                            style={{ backgroundColor: team?.color ?? "#0f172a" }}
                          >
                            {team?.logo ?? "??"}
                          </span>
                          <div>
                            <Link
                              href={`/dashboard/teams/${c.teamId}`}
                              className="font-medium text-[var(--color-ink)] hover:underline"
                            >
                              {team?.name ?? c.teamId}
                            </Link>
                            <p className="text-xs text-[var(--color-ink-muted)]">{team?.city}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-[var(--color-ink-soft)] tabular-nums">
                        {c.assignmentsCount}
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-[var(--color-ink-soft)] tabular-nums">
                        € {c.grossRevenue.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-[var(--color-ink-muted)] tabular-nums">
                        {c.commissionPercent}%
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-semibold text-[var(--color-ink)] tabular-nums">
                        € {c.commissionAmount.toLocaleString()}
                      </td>
                      <td className="px-6 py-3">
                        <Badge bg={meta.bg} fg={meta.fg} size="sm">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: meta.dot }}
                          />
                          {meta.label}
                        </Badge>
                        {c.paidAt && (
                          <p className="mt-0.5 text-[10px] text-[var(--color-ink-muted)]">
                            {c.paidAt} · {c.paidRef}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {c.status === "paid" ? (
                          <span className="text-xs text-[var(--color-ink-faint)]">—</span>
                        ) : (
                          <Button variant="ghost" size="sm">
                            {c.status === "on_hold"
                              ? "Review"
                              : c.status === "pending"
                                ? "Approve"
                                : "Mark paid"}
                            <IconArrowRight size={12} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border-strong)] bg-[var(--color-bg-alt)]">
                  <td colSpan={5} className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Total {period}
                  </td>
                  <td className="px-6 py-3 text-right text-base font-semibold tabular-nums">
                    € {(totalOwed + totalPaid).toLocaleString()}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Rules preview */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Commission rules</CardTitle>
              <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                Default rate is 15% of gross revenue — override per team if needed.
              </p>
            </div>
            <Button variant="secondary" size="sm" href="/dashboard/admin/price-list">
              Edit price list
            </Button>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TEAMS.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
                  style={{ borderLeftWidth: "3px", borderLeftColor: t.color }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                      style={{ backgroundColor: t.color }}
                    >
                      {t.logo}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-ink)]">{t.name}</p>
                      <p className="text-xs text-[var(--color-ink-muted)]">Default rate</p>
                    </div>
                  </div>
                  <span className="text-lg font-semibold tabular-nums text-[var(--color-ink)]">
                    15%
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "strong" | "ok" | "warn" | "danger";
}) {
  const barColor = {
    strong: "var(--color-brand)",
    ok: "var(--color-epc)",
    warn: "#f59e0b",
    danger: "var(--color-asbestos)",
  }[tone];
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: barColor }}
        />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-ink)] tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{hint}</p>}
    </div>
  );
}

function Tab({ label, count, active = false }: { label: string; count: number; active?: boolean }) {
  return (
    <button
      className={
        "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors " +
        (active
          ? "border-[var(--color-brand)] text-[var(--color-ink)]"
          : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]")
      }
    >
      {label}
      <span
        className={
          "rounded-full px-1.5 text-[10px] font-semibold " +
          (active
            ? "bg-[var(--color-brand)] text-white"
            : "bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]")
        }
      >
        {count}
      </span>
    </button>
  );
}
