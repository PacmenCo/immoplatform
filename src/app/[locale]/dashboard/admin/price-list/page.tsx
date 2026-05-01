import { getTranslations } from "next-intl/server";
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
  const tTop = await getTranslations("dashboard.admin.priceList.topbar");
  const tP = await getTranslations("dashboard.admin.priceList");
  const tCard = await getTranslations("dashboard.admin.priceList.card");
  const tTable = await getTranslations("dashboard.admin.priceList.table");

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
      <Topbar title={tTop("title")} subtitle={tTop("subtitle")} />

      <div className="p-4 sm:p-8 max-w-[1400px] space-y-6">
        <p className="text-sm text-[var(--color-ink-muted)]">
          {tP.rich("intro", {
            db: () => (
              <code className="rounded bg-[var(--color-bg-alt)] px-1.5 py-0.5 text-xs">
                {process.env.ODOO_DB ?? "Odoo"}
              </code>
            ),
          })}
        </p>

        {error ? (
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--color-danger)]">
                {tP("loadError", { error })}
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{tCard("title")}</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                {tCard("summary", { total: pricelists.length, active: activeCount })}
              </p>
            </CardHeader>
            <CardBody className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">{tTable("name")}</th>
                    <th className="px-6 py-3 text-left font-medium">{tTable("currency")}</th>
                    <th className="px-6 py-3 text-left font-medium">{tTable("company")}</th>
                    <th className="px-6 py-3 text-right font-medium">{tTable("items")}</th>
                    <th className="px-6 py-3 text-left font-medium">{tTable("status")}</th>
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
                        {p.active ? <Badge>{tTable("active")}</Badge> : <Badge>{tTable("archived")}</Badge>}
                      </td>
                    </tr>
                  ))}
                  {pricelists.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-sm text-[var(--color-ink-muted)]"
                      >
                        {tTable("empty")}
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
