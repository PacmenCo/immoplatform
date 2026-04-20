import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  IconMail,
  IconCalendar,
  IconArrowRight,
  IconCheck,
  IconAlert,
} from "@/components/ui/Icons";
import { COMMISSIONS, TEAMS } from "@/lib/mockData";

// Derive recipients for current month (pending/approved balances that need a reminder)
const period = "2026-04";
const recipients = COMMISSIONS.filter(
  (c) => c.period === period && c.status !== "paid",
).map((c) => {
  const team = TEAMS.find((t) => t.id === c.teamId);
  return {
    id: c.id,
    teamId: c.teamId,
    team,
    balance: c.commissionAmount,
    assignmentsCount: c.assignmentsCount,
  };
});

const recentSends = [
  { id: "s_01", period: "2026-03", at: "2026-03-01 09:00", count: 6, delivered: 6, opened: 4, clicked: 3, failed: 0 },
  { id: "s_02", period: "2026-02", at: "2026-02-01 09:00", count: 5, delivered: 5, opened: 5, clicked: 2, failed: 0 },
  { id: "s_03", period: "2026-01", at: "2026-01-02 09:00", count: 5, delivered: 4, opened: 3, clicked: 1, failed: 1 },
];

export default function InvoiceRemindersPage() {
  const totalOwed = recipients.reduce((s, r) => s + r.balance, 0);

  return (
    <>
      <Topbar title="Invoice reminders" subtitle="Monthly balance emails to your teams" />

      <div className="p-8 max-w-[1300px] space-y-6">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]"
        >
          <Link href="/dashboard/admin" className="hover:text-[var(--color-ink)]">
            Admin
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[var(--color-ink-soft)]">Invoice reminders</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {/* Schedule card */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Schedule</CardTitle>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                    When reminders go out automatically.
                  </p>
                </div>
                <Button variant="secondary" size="sm">
                  Edit schedule
                </Button>
              </CardHeader>
              <CardBody className="grid gap-4 sm:grid-cols-3">
                <ScheduleStat
                  label="Runs"
                  value="1st of every month"
                  hint="Sent at 09:00 CET"
                />
                <ScheduleStat
                  label="Next run"
                  value="May 1, 2026"
                  hint="12 days from now"
                />
                <ScheduleStat
                  label="Recipients"
                  value={`${recipients.length} teams`}
                  hint={`€ ${totalOwed.toLocaleString()} outstanding`}
                />
              </CardBody>
            </Card>

            {/* Recipients preview */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Next reminder — recipients</CardTitle>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                    Teams with a non-zero balance for {period} will get an email.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    Preview email
                  </Button>
                  <Button size="sm">
                    <IconMail size={14} />
                    Send now
                  </Button>
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                      <th className="px-6 py-3 text-left font-semibold">Team</th>
                      <th className="px-6 py-3 text-left font-semibold">Recipient</th>
                      <th className="px-6 py-3 text-right font-semibold">Assignments</th>
                      <th className="px-6 py-3 text-right font-semibold">Balance</th>
                      <th className="px-6 py-3 text-right font-semibold" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {recipients.map((r) => (
                      <tr key={r.id} className="hover:bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                              style={{ backgroundColor: r.team?.color ?? "#0f172a" }}
                            >
                              {r.team?.logo ?? "??"}
                            </span>
                            <Link
                              href={`/dashboard/teams/${r.teamId}`}
                              className="font-medium text-[var(--color-ink)] hover:underline"
                            >
                              {r.team?.name ?? r.teamId}
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-[var(--color-ink-soft)]">
                          billing@
                          {r.team?.name.toLowerCase().replace(/\s+/g, "") ?? "team"}.be
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-[var(--color-ink-soft)]">
                          {r.assignmentsCount}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums font-semibold text-[var(--color-ink)]">
                          € {r.balance.toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Button variant="ghost" size="sm">
                            <IconMail size={12} />
                            Send now
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Recent sends */}
            <Card>
              <CardHeader>
                <CardTitle>Recent sends</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                      <th className="px-6 py-3 text-left font-semibold">Period</th>
                      <th className="px-6 py-3 text-left font-semibold">Sent at</th>
                      <th className="px-6 py-3 text-right font-semibold">Recipients</th>
                      <th className="px-6 py-3 text-right font-semibold">Delivered</th>
                      <th className="px-6 py-3 text-right font-semibold">Opened</th>
                      <th className="px-6 py-3 text-right font-semibold">Clicked</th>
                      <th className="px-6 py-3 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {recentSends.map((s) => (
                      <tr key={s.id} className="hover:bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]">
                        <td className="px-6 py-3 font-medium text-[var(--color-ink)] tabular-nums">
                          {s.period}
                        </td>
                        <td className="px-6 py-3 text-[var(--color-ink-soft)] tabular-nums">
                          {s.at}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-[var(--color-ink-soft)]">
                          {s.count}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-[var(--color-ink-soft)]">
                          {s.delivered}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-[var(--color-ink-soft)]">
                          {s.opened} ({Math.round((s.opened / s.count) * 100)}%)
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-[var(--color-ink-soft)]">
                          {s.clicked} ({Math.round((s.clicked / s.count) * 100)}%)
                        </td>
                        <td className="px-6 py-3">
                          {s.failed === 0 ? (
                            <Badge bg="#dcfce7" fg="#15803d" size="sm">
                              <IconCheck size={10} />
                              All delivered
                            </Badge>
                          ) : (
                            <Badge bg="#fef2f2" fg="#b91c1c" size="sm">
                              <IconAlert size={10} />
                              {s.failed} failed
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right: email preview */}
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Email preview</CardTitle>
                <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                  Template rendered with example data.
                </p>
              </CardHeader>
              <CardBody>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
                  <div className="mb-3 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                    <IconMail size={12} />
                    <span>From: Immo Billing &lt;billing@immo.app&gt;</span>
                  </div>
                  <p className="font-semibold text-[var(--color-ink)]">
                    Your April balance is € 1,413.00
                  </p>
                  <p className="mt-3 text-[var(--color-ink-soft)]">
                    Hi Vastgoed Antwerp team,
                  </p>
                  <p className="mt-2 text-[var(--color-ink-soft)]">
                    Here&apos;s a summary of your April commission with Immo.
                  </p>
                  <div className="mt-4 rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                    <div className="flex items-center justify-between text-xs text-[var(--color-ink-muted)]">
                      <span>Assignments delivered</span>
                      <span className="tabular-nums text-[var(--color-ink)]">18</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--color-ink-muted)]">
                      <span>Gross revenue</span>
                      <span className="tabular-nums text-[var(--color-ink)]">
                        € 9,420.00
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                      <span className="text-sm font-medium text-[var(--color-ink)]">
                        Your share (15%)
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-[var(--color-ink)]">
                        € 1,413.00
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 inline-block rounded-md bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-white">
                    View your dashboard →
                  </div>
                  <p className="mt-4 text-xs text-[var(--color-ink-muted)]">
                    Payout expected by May 15 via SEPA transfer.
                  </p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-2 text-sm">
                <div className="flex items-center gap-2 font-medium text-[var(--color-ink)]">
                  <IconCalendar size={14} />
                  Manual actions
                </div>
                <Link
                  href="#"
                  className="flex items-center justify-between text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                >
                  Send test email to myself
                  <IconArrowRight size={12} />
                </Link>
                <Link
                  href="#"
                  className="flex items-center justify-between text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                >
                  Dry run (no emails sent)
                  <IconArrowRight size={12} />
                </Link>
                <Link
                  href="#"
                  className="flex items-center justify-between text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                >
                  Pause all reminders
                  <IconArrowRight size={12} />
                </Link>
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}

function ScheduleStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
        {label}
      </p>
      <p className="mt-1.5 text-base font-semibold text-[var(--color-ink)]">{value}</p>
      <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{hint}</p>
    </div>
  );
}
