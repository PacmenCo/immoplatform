import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconArrowRight } from "@/components/ui/Icons";
import { requireRoleOrRedirect } from "@/lib/auth";
import { SettingsNav } from "../_nav";
import { SettingsScopeBanner } from "@/components/dashboard/SettingsScopeBanner";

const INVOICES = [
  { id: "INV-2026-04", date: "2026-04-01", amount: "€ 99.00", status: "paid" },
  { id: "INV-2026-03", date: "2026-03-01", amount: "€ 99.00", status: "paid" },
  { id: "INV-2026-02", date: "2026-02-01", amount: "€ 99.00", status: "paid" },
  { id: "INV-2026-01", date: "2026-01-01", amount: "€ 99.00", status: "paid" },
  { id: "INV-2025-12", date: "2025-12-01", amount: "€ 79.00", status: "paid" },
];

export default async function BillingSettingsPage() {
  await requireRoleOrRedirect(["admin", "staff"], "admin");
  return (
    <>
      <Topbar title="Billing" subtitle="Plan, payment method, invoices" />

      <div className="p-8 max-w-[960px]">
        <SettingsNav />
        <div className="mt-6 space-y-8">
          <SettingsScopeBanner scope="org" />
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Current plan</CardTitle>
              <Badge
                bg="color-mix(in srgb, var(--color-epc) 14%, var(--color-bg))"
                fg="var(--color-epc)"
              >
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
                  Pro
                </p>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                  <span className="text-2xl font-semibold text-[var(--color-ink)]">€ 99</span>
                  <span className="text-[var(--color-ink-muted)]">/month</span>
                </p>
                <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                  Up to 10 seats, unlimited assignments, priority scheduling.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" size="md">Downgrade</Button>
                <Button variant="primary" size="md">
                  Upgrade to Enterprise
                  <IconArrowRight size={14} />
                </Button>
              </div>
            </div>
            <div className="mt-6 grid gap-4 border-t border-[var(--color-border)] pt-6 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
                  Next invoice
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">1 May 2026</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
                  Seats used
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">7 / 10</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
                  Billing cycle
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">Monthly</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment method</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-14 place-items-center rounded-md bg-[var(--color-ink)] text-xs font-bold text-white">
                  VISA
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    Visa ending in 4242
                  </p>
                  <p className="text-xs text-[var(--color-ink-muted)]">Expires 08/2028</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm">Replace</Button>
                <Button variant="ghost" size="sm">Remove</Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Past invoices</CardTitle>
              <Button variant="ghost" size="sm">Export all</Button>
            </div>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <th className="px-6 py-3">Invoice</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Download</th>
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-alt)]"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-[var(--color-ink)]">
                      {inv.id}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-ink-soft)]">{inv.date}</td>
                    <td className="px-6 py-4 font-medium text-[var(--color-ink)]">
                      {inv.amount}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        bg="color-mix(in srgb, var(--color-epc) 14%, var(--color-bg))"
                        fg="var(--color-epc)"
                      >
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href="#"
                        className="text-sm font-medium text-[var(--color-ink)] hover:underline"
                      >
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        </div>
      </div>
    </>
  );
}
