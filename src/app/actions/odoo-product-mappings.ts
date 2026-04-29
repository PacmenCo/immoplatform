"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { withSession, type ActionResult } from "./_types";

/**
 * Per-(team, service, propertyType) Odoo product-name mapping CRUD.
 * Admin-only. Wires v1's Livewire `PriceListEditor` (the local pricelist
 * with `odoo_product_name` columns) into v2 via the `OdooProductMapping`
 * model.
 *
 * `teamId === null` is the global default row — what v1 calls
 * "default pricelist" tier 2. Per-team rows are tier 1.
 */

const KNOWN_SERVICE_KEYS = new Set(["asbestos", "epc", "electrical", "fuel"]);

/**
 * Property-type values valid on `Assignment.propertyType`. v2's
 * `AssignmentForm.tsx:248-252` is the canonical source. Keep this in sync
 * if new types ever land.
 */
const KNOWN_PROPERTY_TYPES = new Set([
  "house",
  "apartment",
  "studio",
  "studio_room",
  "commercial",
]);

export const setOdooProductMapping = withSession(async (
  session,
  args: {
    teamId: string | null;
    serviceKey: string;
    propertyType: string;
    odooProductName: string;
  },
): Promise<ActionResult> => {
  if (!hasRole(session, "admin")) {
    return { ok: false, error: "Admins only." };
  }
  const teamId = args.teamId ?? null;
  const serviceKey = args.serviceKey?.trim();
  const propertyType = args.propertyType?.trim();
  const odooProductName = args.odooProductName?.trim();

  if (!serviceKey || !KNOWN_SERVICE_KEYS.has(serviceKey)) {
    return { ok: false, error: "Unknown service key." };
  }
  if (!propertyType || !KNOWN_PROPERTY_TYPES.has(propertyType)) {
    return { ok: false, error: "Unknown property type." };
  }
  if (!odooProductName) {
    return { ok: false, error: "Product name is required." };
  }
  if (odooProductName.length > 200) {
    return { ok: false, error: "Product name is too long (max 200 chars)." };
  }

  if (teamId !== null) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });
    if (!team) return { ok: false, error: "Team not found." };
  }

  // teamId is part of the unique compound index. Prisma's compound-unique
  // can't slot through a literal null in `where: { teamId_..._..._... }`,
  // so we findFirst + create/update for null rows.
  const existing = await prisma.odooProductMapping.findFirst({
    where: { teamId, serviceKey, propertyType },
    select: { id: true },
  });
  if (existing) {
    await prisma.odooProductMapping.update({
      where: { id: existing.id },
      data: { odooProductName },
    });
  } else {
    await prisma.odooProductMapping.create({
      data: { teamId, serviceKey, propertyType, odooProductName },
    });
  }

  await audit({
    actorId: session.user.id,
    verb: "odoo_product_mapping.set",
    objectType: "odoo_product_mapping",
    objectId: existing?.id,
    metadata: { teamId, serviceKey, propertyType, odooProductName },
  });

  revalidatePath("/dashboard/admin/odoo-products");
  return { ok: true };
});

export const deleteOdooProductMapping = withSession(async (
  session,
  args: { id: string },
): Promise<ActionResult> => {
  if (!hasRole(session, "admin")) {
    return { ok: false, error: "Admins only." };
  }
  if (!args.id) return { ok: false, error: "Missing id." };

  const existing = await prisma.odooProductMapping.findUnique({
    where: { id: args.id },
    select: {
      id: true,
      teamId: true,
      serviceKey: true,
      propertyType: true,
      odooProductName: true,
    },
  });
  if (!existing) return { ok: false, error: "Mapping not found." };

  await prisma.odooProductMapping.delete({ where: { id: existing.id } });
  await audit({
    actorId: session.user.id,
    verb: "odoo_product_mapping.deleted",
    objectType: "odoo_product_mapping",
    objectId: existing.id,
    metadata: {
      teamId: existing.teamId,
      serviceKey: existing.serviceKey,
      propertyType: existing.propertyType,
      odooProductName: existing.odooProductName,
    },
  });

  revalidatePath("/dashboard/admin/odoo-products");
  return { ok: true };
});
