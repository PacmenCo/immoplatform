import "server-only";

import { prisma } from "@/lib/db";
import { listPricelistItems, type OdooPricelistItem } from "@/lib/odoo";

/**
 * Resolve the per-service Odoo pricelist items a given team has access to
 * when creating an assignment. Today only the `asbestos` service is wired
 * to a pricelist binding (per the per-service config in `TeamPriceOverrides`);
 * EK / EPC will follow once their Odoo product mappings are confirmed.
 *
 * Returns a map keyed by service key. Service keys not bound to a pricelist
 * (or with an unreachable Odoo) come back missing — callers should treat
 * absence as "no picker, fall back to base price".
 *
 * Every item in the bound pricelist is returned verbatim — pricelist
 * curation is the user's job in Odoo, the system doesn't second-guess what
 * belongs to which service.
 */
export async function getTeamPricelistItemsByService(
  teamId: string | null | undefined,
): Promise<Record<string, OdooPricelistItem[]>> {
  if (!teamId) return {};
  const bindings = await prisma.teamServiceOverride.findMany({
    where: { teamId, odooPricelistId: { not: null } },
    select: { serviceKey: true, odooPricelistId: true },
  });
  if (bindings.length === 0) return {};

  const ids = Array.from(
    new Set(bindings.map((b) => b.odooPricelistId).filter((id): id is number => id !== null)),
  );
  let items: OdooPricelistItem[];
  try {
    items = await listPricelistItems(ids);
  } catch {
    return {};
  }

  const result: Record<string, OdooPricelistItem[]> = {};
  for (const b of bindings) {
    if (b.odooPricelistId == null) continue;
    result[b.serviceKey] = items.filter(
      (it) => it.pricelistId === b.odooPricelistId,
    );
  }
  return result;
}
