import "server-only";

import { prisma } from "@/lib/db";
import { listPricelistItems, type OdooPricelistItem } from "@/lib/odoo";

/**
 * Resolve the per-service Odoo pricelist items a given team has access to
 * when creating an assignment. Today only the `asbestos` service is wired
 * to a pricelist binding (per the per-service config in `TeamPriceOverrides`);
 * EK / EPC will follow once their Odoo product mappings are confirmed.
 *
 * Every item in the bound pricelist is returned verbatim — pricelist
 * curation is the user's job in Odoo, the system doesn't second-guess what
 * belongs to which service.
 *
 * Failure path: when the Odoo round-trip throws, `byService` comes back
 * empty AND `odooError` is set. Callers MUST distinguish the two so the
 * UI can surface "Odoo unreachable" instead of silently hiding the picker
 * (admins otherwise can't tell whether they need to bind a pricelist or
 * check the integration).
 */
export type TeamPricelistItemsResult = {
  byService: Record<string, OdooPricelistItem[]>;
  odooError: string | null;
};

export async function getTeamPricelistItemsByService(
  teamId: string | null | undefined,
): Promise<TeamPricelistItemsResult> {
  if (!teamId) return { byService: {}, odooError: null };
  const bindings = await prisma.teamServiceOverride.findMany({
    where: { teamId, odooPricelistId: { not: null } },
    select: { serviceKey: true, odooPricelistId: true },
  });
  if (bindings.length === 0) return { byService: {}, odooError: null };

  const ids = Array.from(
    new Set(bindings.map((b) => b.odooPricelistId).filter((id): id is number => id !== null)),
  );
  let items: OdooPricelistItem[];
  try {
    items = await listPricelistItems(ids);
  } catch (e) {
    return {
      byService: {},
      odooError: e instanceof Error ? e.message : "Odoo unreachable",
    };
  }

  const byService: Record<string, OdooPricelistItem[]> = {};
  for (const b of bindings) {
    if (b.odooPricelistId == null) continue;
    byService[b.serviceKey] = items.filter(
      (it) => it.pricelistId === b.odooPricelistId,
    );
  }
  return { byService, odooError: null };
}
