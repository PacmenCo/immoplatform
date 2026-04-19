import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ServicePill } from "@/components/ui/Badge";
import { SERVICES } from "@/lib/mockData";

const months = [
  { label: "Jan", value: 18400 },
  { label: "Feb", value: 22100 },
  { label: "Mar", value: 19800 },
  { label: "Apr", value: 24850 },
];

const byService = [
  { key: "epc" as const, value: 9200 },
  { key: "asbestos" as const, value: 10400 },
  { key: "electrical" as const, value: 3250 },
  { key: "fuel" as const, value: 2000 },
];

const totals = byService.reduce((sum, s) => sum + s.value, 0);
const peakMonth = Math.max(...months.map((m) => m.value));

export default function RevenueOverviewPage() {
  return (
    <>
      <Topbar title="Revenue overview" subtitle="April 2026" />

      <div className="p-8 max-w-[1400px] space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {["April 2026", "March 2026", "February 2026", "Q1 2026", "Year 2026"].map((p, i) => (
              <button
                key={p}
                className={
                  i === 0
                    ? "rounded-md border border-[var(--color-border-strong)] bg-white px-3 py-1.5 text-sm font-medium"
                    : "rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                }
              >
                {p}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm">Export CSV</Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Monthly revenue</h2>
              <p className="text-xs text-[var(--color-ink-muted)]">Last 4 months</p>
            </div>
            <div className="mt-8 flex h-48 items-end justify-between gap-4">
              {months.map((m) => {
                const h = (m.value / peakMonth) * 100;
                return (
                  <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="w-full flex flex-col-reverse items-center">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-[var(--color-brand)] to-[var(--color-brand-soft)]"
                        style={{ height: `${h}%` }}
                        title={`€ ${m.value.toLocaleString()}`}
                      />
                    </div>
                    <p className="text-xs text-[var(--color-ink-muted)]">{m.label}</p>
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      € {m.value.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By service (April)</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {byService.map((s) => {
                const svc = SERVICES[s.key];
                const pct = Math.round((s.value / totals) * 100);
                return (
                  <div key={s.key}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <ServicePill color={svc.color} label={svc.short} />
                        <span className="text-[var(--color-ink-soft)]">{svc.label}</span>
                      </div>
                      <span className="font-medium text-[var(--color-ink)]">
                        € {s.value.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: svc.color }} />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-baseline justify-between border-t border-[var(--color-border)] pt-4">
                <span className="text-sm text-[var(--color-ink-muted)]">Total</span>
                <span className="text-xl font-semibold">€ {totals.toLocaleString()}</span>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Commission payouts</CardTitle>
            <span className="text-xs text-[var(--color-ink-muted)]">April 2026</span>
          </CardHeader>
          <CardBody>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <th className="text-left font-semibold py-3">Team</th>
                  <th className="text-right font-semibold py-3">Assignments</th>
                  <th className="text-right font-semibold py-3">Revenue</th>
                  <th className="text-right font-semibold py-3">Commission</th>
                  <th className="text-right font-semibold py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {[
                  ["Vastgoed Antwerp", 18, 9420, 1413, "Pending"],
                  ["Immo Bruxelles", 12, 6100, 915, "Paid"],
                  ["Gent Huizen", 9, 4280, 642, "Paid"],
                  ["Mechelen Makelaars", 4, 2010, 301, "Pending"],
                  ["Immo Liège", 7, 2320, 348, "Pending"],
                  ["Brugge Vastgoed", 3, 720, 108, "Paid"],
                ].map((row) => (
                  <tr key={String(row[0])}>
                    <td className="py-3 font-medium text-[var(--color-ink)]">{row[0]}</td>
                    <td className="py-3 text-right text-[var(--color-ink-soft)]">{row[1]}</td>
                    <td className="py-3 text-right text-[var(--color-ink-soft)]">
                      € {(row[2] as number).toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-medium text-[var(--color-ink)]">
                      € {(row[3] as number).toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={
                          row[4] === "Paid"
                            ? { backgroundColor: "#dcfce7", color: "#15803d" }
                            : { backgroundColor: "#fef3c7", color: "#b45309" }
                        }
                      >
                        {row[4]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
