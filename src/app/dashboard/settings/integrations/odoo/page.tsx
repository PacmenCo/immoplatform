import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  IconAlert,
  IconCheck,
  IconRefresh,
  IconPlug,
  IconArrowRight,
} from "@/components/ui/Icons";
import { INTEGRATIONS, ODOO_SYNC_LOG } from "@/lib/mockData";
import { SettingsNav } from "../../_nav";

const STATUS_META = {
  ok: { label: "Success", bg: "#dcfce7", fg: "#15803d", dot: "#10b981" },
  failed: { label: "Failed", bg: "#fef2f2", fg: "#b91c1c", dot: "#ef4444" },
  retrying: { label: "Retrying", bg: "#fef3c7", fg: "#b45309", dot: "#f59e0b" },
};

export default function OdooIntegrationPage() {
  const odoo = INTEGRATIONS.find((i) => i.key === "odoo")!;
  const errorCount = ODOO_SYNC_LOG.filter((r) => r.status === "failed").length;
  const okCount = ODOO_SYNC_LOG.filter((r) => r.status === "ok").length;
  const lastOk = ODOO_SYNC_LOG.find((r) => r.status === "ok");

  return (
    <>
      <Topbar title="Odoo" subtitle="ERP sync — invoices, products, contacts" />

      <div className="p-8 max-w-[1200px]">
        <SettingsNav />

        {/* Breadcrumb back to integrations */}
        <nav aria-label="Breadcrumb" className="mt-6 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          <Link href="/dashboard/settings/integrations" className="hover:text-[var(--color-ink)]">
            Integrations
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[var(--color-ink-soft)]">Odoo</span>
        </nav>

        {/* Status hero */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Card>
              <CardBody className="flex items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-[#f3e8fd] text-base font-bold text-[#714b67]">
                  OD
                </span>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-[var(--color-ink)]">Odoo</p>
                  <p className="text-sm text-[var(--color-ink-soft)]">
                    {odoo.description}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-epc)_14%,var(--color-bg))] px-2.5 py-0.5 font-medium text-[var(--color-epc)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-epc)]" />
                      Connected
                    </span>
                    <span className="text-[var(--color-ink-muted)]">
                      Endpoint: odoo.immo.app
                    </span>
                    {odoo.lastSyncAt && (
                      <span className="text-[var(--color-ink-muted)]">
                        Last sync {odoo.lastSyncAt}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm">
                    <IconRefresh size={14} />
                    Sync now
                  </Button>
                  <Button variant="ghost" size="sm">
                    Disconnect
                  </Button>
                </div>
              </CardBody>
            </Card>

            {errorCount > 0 && (
              <div className="flex items-start gap-3 rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] p-4 text-sm">
                <IconAlert size={18} className="mt-0.5 shrink-0 text-[var(--color-asbestos)]" />
                <div className="flex-1">
                  <p className="font-medium text-[var(--color-ink)]">
                    {errorCount} failed sync{errorCount === 1 ? "" : "s"} in the last 7 days
                  </p>
                  <p className="mt-0.5 text-[var(--color-ink-soft)]">
                    Retry individually below, or check the product mapping in the price
                    list.
                  </p>
                </div>
                <Button href="/dashboard/admin/price-list" variant="secondary" size="sm">
                  Price list
                </Button>
              </div>
            )}

            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent syncs</CardTitle>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                    {okCount} OK · {errorCount} failed · 1 retrying
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  View full log →
                </Button>
              </CardHeader>
              {ODOO_SYNC_LOG.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-[var(--color-ink-muted)]">
                  No syncs recorded yet — check back after the next run.
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                      <th className="px-6 py-3 text-left font-semibold">When</th>
                      <th className="px-6 py-3 text-left font-semibold">Entity</th>
                      <th className="px-6 py-3 text-left font-semibold">Direction</th>
                      <th className="px-6 py-3 text-right font-semibold">Items</th>
                      <th className="px-6 py-3 text-left font-semibold">Status</th>
                      <th className="px-6 py-3 text-right font-semibold" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {ODOO_SYNC_LOG.map((r) => {
                      const meta = STATUS_META[r.status];
                      return (
                        <tr key={r.id} className="align-top">
                          <td className="px-6 py-3 whitespace-nowrap text-[var(--color-ink-soft)] tabular-nums">
                            {r.at}
                          </td>
                          <td className="px-6 py-3 capitalize text-[var(--color-ink)]">
                            {r.entity}
                          </td>
                          <td className="px-6 py-3 text-sm text-[var(--color-ink-muted)]">
                            {r.direction === "push" ? "→ Odoo" : "← Odoo"}
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums text-[var(--color-ink-soft)]">
                            {r.itemsCount}
                          </td>
                          <td className="px-6 py-3">
                            <Badge bg={meta.bg} fg={meta.fg} size="sm">
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: meta.dot }}
                              />
                              {meta.label}
                            </Badge>
                            {r.message && (
                              <p className="mt-1 max-w-sm text-[11px] text-[var(--color-ink-muted)]">
                                {r.message}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {r.status === "failed" ? (
                              <Button variant="ghost" size="sm">
                                <IconRefresh size={12} />
                                Retry
                              </Button>
                            ) : (
                              <span className="text-xs text-[var(--color-ink-faint)]">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </Card>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardBody className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Last successful sync
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-ink)] tabular-nums">
                    {lastOk?.at ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Schedule
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                    Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Entities synced
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-[var(--color-ink-soft)]">
                    {[
                      "Invoices (push)",
                      "Products (push)",
                      "Contacts (pull)",
                      "Assignments (push)",
                    ].map((e) => (
                      <li key={e} className="inline-flex items-center gap-2">
                        <IconCheck size={12} className="text-[var(--color-epc)]" />
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                  <IconPlug size={14} />
                  Configuration
                </div>
                <Link
                  href="/dashboard/admin/price-list"
                  className="flex items-center justify-between text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                >
                  Product ID mapping
                  <IconArrowRight size={12} />
                </Link>
                <Link
                  href="#"
                  className="flex items-center justify-between text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                >
                  Tax mapping
                  <IconArrowRight size={12} />
                </Link>
                <Link
                  href="#"
                  className="flex items-center justify-between text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                >
                  Webhook secrets
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
