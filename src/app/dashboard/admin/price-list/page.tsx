import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { listPricelists, type OdooPricelist } from "@/lib/odoo";

// Re-fetch from Odoo at most every 5 minutes per render. Admin-only page so
// the staleness window is fine; bypass with a hard refresh / redeploy.
export const revalidate = 300;

function currencyLabel(p: OdooPricelist): string {
  return p.currency_id ? p.currency_id[1] : "—";
}

function companyLabel(p: OdooPricelist): string {
  return p.company_id ? p.company_id[1] : "—";
}

export default async function PriceListPage() {
  let pricelists: OdooPricelist[] = [];
  let error: string | null = null;
  try {
    pricelists = await listPricelists();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load Odoo pricelists";
  }

  const activeCount = pricelists.filter((p) => p.active).length;

  return (
    <>
      <Topbar title="Pricelists" subtitle="Live pricelists from Odoo" />

      <div className="p-4 sm:p-8 max-w-[1400px] space-y-6">
        <p className="text-sm text-[var(--color-ink-muted)]">
          Read-only view of pricelists in <code className="rounded bg-[var(--color-bg-alt)] px-1.5 py-0.5 text-xs">{process.env.ODOO_DB ?? "Odoo"}</code>. Edit in Odoo — changes refresh here within a few minutes.
        </p>

        {error ? (
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--color-danger)]">
                Could not load Odoo pricelists: {error}
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Pricelists</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                {pricelists.length} total · {activeCount} active
              </p>
            </CardHeader>
            <CardBody className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">Name</th>
                    <th className="px-6 py-3 text-left font-medium">Currency</th>
                    <th className="px-6 py-3 text-left font-medium">Company</th>
                    <th className="px-6 py-3 text-right font-medium">Items</th>
                    <th className="px-6 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pricelists.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-[var(--color-border)] align-top"
                    >
                      <td className="px-6 py-4 min-w-[260px] font-medium text-[var(--color-ink)]">
                        {p.name}
                      </td>
                      <td className="px-6 py-4 text-[var(--color-ink-soft)]">
                        {currencyLabel(p)}
                      </td>
                      <td className="px-6 py-4 text-[var(--color-ink-soft)]">
                        {companyLabel(p)}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums">
                        {p.itemCount}
                      </td>
                      <td className="px-6 py-4">
                        {p.active ? <Badge>Active</Badge> : <Badge>Archived</Badge>}
                      </td>
                    </tr>
                  ))}
                  {pricelists.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-sm text-[var(--color-ink-muted)]"
                      >
                        No pricelists found in Odoo.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
