import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { prisma } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/auth";
import { OdooProductMappingsTable } from "./OdooProductMappingsTable";

/**
 * Admin UI for `OdooProductMapping`. Ports v1's `PriceListEditor` Livewire
 * component — admins set per-(team, service, propertyType) Odoo product
 * names that drive the sync orchestrator's tier-1 / tier-2 lookup.
 *
 * Default rows (`teamId = null`) are seeded; admins extend with team-specific
 * overrides. EPC needs at least one row here to ever reach Odoo (no
 * hardcoded fallback) — same as v1.
 */

export const metadata = { title: "Odoo product mappings" };

export default async function OdooProductMappingsPage() {
  await requireRoleOrRedirect(["admin"], "admin");

  const [mappings, teams, services] = await Promise.all([
    prisma.odooProductMapping.findMany({
      orderBy: [
        { teamId: "asc" },
        { serviceKey: "asc" },
        { propertyType: "asc" },
      ],
      include: {
        team: { select: { id: true, name: true } },
      },
    }),
    prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({
      select: { key: true, label: true, short: true },
      orderBy: { label: "asc" },
    }),
  ]);

  // Strip the `team` Prisma object before handing off to the client. The
  // client only needs the team name when present and the team id key.
  const rows = mappings.map((m) => ({
    id: m.id,
    teamId: m.teamId,
    teamName: m.team?.name ?? null,
    serviceKey: m.serviceKey,
    propertyType: m.propertyType,
    odooProductName: m.odooProductName,
    updatedAt: m.updatedAt.toISOString(),
  }));

  return (
    <>
      <Topbar
        title="Odoo product mappings"
        subtitle="Per-(team, service, property type) → Odoo product name"
      />
      <div className="p-4 sm:p-8 max-w-[1400px] space-y-6">
        <p className="text-sm text-[var(--color-ink-muted)]">
          When an assignment is created, the sync resolves an Odoo product per
          service in this order: <strong>1.</strong> the realtor&rsquo;s pre-pick
          on the create form (if the team has a pricelist binding),{" "}
          <strong>2.</strong> a row here matching the assignment&rsquo;s team,{" "}
          <strong>3.</strong> a default row (Team blank), <strong>4.</strong> a
          hardcoded asbestos fallback. EPC needs at least one row here (no
          hardcoded fallback). Mirrors Platform v1&rsquo;s 3-tier lookup.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Mappings</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              {rows.length} {rows.length === 1 ? "row" : "rows"}
            </p>
          </CardHeader>
          <CardBody className="p-0">
            <OdooProductMappingsTable
              initialRows={rows}
              teams={teams}
              services={services}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
