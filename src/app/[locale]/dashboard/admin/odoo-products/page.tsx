import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.pageTitles");
  return { title: t("odooProducts") };
}

export default async function OdooProductMappingsPage() {
  await requireRoleOrRedirect(["admin"], "admin");

  const tTop = await getTranslations("dashboard.admin.odooProducts.topbar");
  const tOd = await getTranslations("dashboard.admin.odooProducts");
  const tCard = await getTranslations("dashboard.admin.odooProducts.card");

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
        title={tTop("title")}
        subtitle={tTop("subtitle")}
      />
      <div className="p-4 sm:p-8 max-w-[1400px] space-y-6">
        <p className="text-sm text-[var(--color-ink-muted)]">
          {tOd.rich("intro", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>

        <Card>
          <CardHeader>
            <CardTitle>{tCard("title")}</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              {tCard("rowCount", { count: rows.length })}
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
