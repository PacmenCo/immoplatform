/**
 * Odoo sync orchestrator. Ports Platform v1's `app/Jobs/SyncAssignmentToOdoo.php`
 * into a Next.js best-effort async function.
 *
 * Pattern: matches `syncAssignmentToCalendars` (src/lib/calendar/sync.ts) —
 * internal try/catch swallows everything, never throws. Callers `await` it
 * without their own error handling.
 *
 * Triggered from two places:
 *   - inline after assignment create (createAssignmentInner)
 *   - manual retry server action (retryAssignmentOdooSync)
 *
 * v1 parity note: v1 uses Laravel's queue worker (2 retries × 30s backoff)
 * for transient-failure auto-recovery. v2 has no equivalent always-running
 * worker, so failed syncs sit red until an admin clicks Retry — the same
 * recovery path v1 admins use beyond the 60s queue window. Failure email
 * is the operator's signal that intervention is needed.
 *
 * Per-assignment state lives in 6 Assignment columns:
 *   odooContactId, odooOrderId, odooLinesSyncedAt, odooSyncedAt,
 *   odooSyncAttempts, odooSyncError
 *
 * Product resolution (4-tier — extends v1's 3-tier with v2's per-line
 * pre-pick):
 *   tier 0: AssignmentService.odooProductTemplateId (v2 form selection)
 *   tier 1: OdooProductMapping for assignment.teamId
 *   tier 2: OdooProductMapping for teamId=null (default)
 *   tier 3: hardcoded asbestos fallback (also seeded into tier 2)
 *
 * Failure path emails ODOO_SYNC_FAILURE_EMAIL (or INVOICE_REMINDER_EMAIL)
 * directly via sendEmail — bypasses notify()/EMAIL_EVENTS to avoid
 * creating a per-user opt-out for an operational alert. v1 parity:
 * Mail::to('jordan@asbestexperts.be').
 */

import "server-only";
import { prisma } from "./db";
import {
  addSaleOrderLine,
  createPartner,
  createSaleOrder,
  findPartnerByEmailOrVat,
  findProductByName,
  findProductByTemplateId,
  getBelgiumCountryId,
  getDefaultPricelistId,
  isOdooConfigured,
} from "./odoo";
import { audit } from "./auth";
import { odooSyncFailedEmail, sendEmail } from "./email";
import { assignmentUrl } from "./urls";

export type SyncTrigger = "create" | "retry";

const ERROR_MAX_LEN = 1000;

/**
 * Hardcoded asbestos property-type → product-name fallback. Mirrors v1's
 * `OdooService::mapPropertyTypeToProduct` translated to v2's English keys.
 * Also seeded into the OdooProductMapping table (teamId=null) — kept here
 * as a defense-in-depth fallback if seed data is missing in production.
 */
function asbestosHardcodedFallback(propertyType: string | null): string | null {
  if (!propertyType) return null;
  switch (propertyType) {
    case "apartment":
    case "studio":
    case "studio_room":
      return "Niet-destructieve Asbestinventaris Appartement";
    case "house":
      return "Niet-destructieve Asbestinventaris Woning";
    default:
      return null;
  }
}

/**
 * Resolve the Odoo product name for a given assignment-service slot.
 * Returns null when no mapping found ("manual quote required" warning).
 *
 * Note: tier 0 (per-line pre-pick) bypasses the name lookup entirely —
 * caller branches before reaching this resolver when a template id is set.
 */
async function resolveProductName(
  assignmentTeamId: string | null,
  serviceKey: string,
  propertyType: string | null,
): Promise<{ name: string; tier: 1 | 2 | 3 } | null> {
  if (!propertyType) return null;

  // Tier 1 — per-team override.
  if (assignmentTeamId) {
    const teamRow = await prisma.odooProductMapping.findUnique({
      where: {
        teamId_serviceKey_propertyType: {
          teamId: assignmentTeamId,
          serviceKey,
          propertyType,
        },
      },
      select: { odooProductName: true },
    });
    if (teamRow?.odooProductName) {
      return { name: teamRow.odooProductName, tier: 1 };
    }
  }

  // Tier 2 — global default. Prisma's compound-unique requires literal
  // null in the teamId slot; findFirst handles it cleanly.
  const defaultRow = await prisma.odooProductMapping.findFirst({
    where: { teamId: null, serviceKey, propertyType },
    select: { odooProductName: true },
  });
  if (defaultRow?.odooProductName) {
    return { name: defaultRow.odooProductName, tier: 2 };
  }

  // Tier 3 — hardcoded asbestos map. Defense-in-depth if seed data is
  // missing. EPC / electrical / fuel have no v1 hardcoded fallback so
  // they fall through to null (MANUAL_QUOTE).
  if (serviceKey === "asbestos") {
    const hardcoded = asbestosHardcodedFallback(propertyType);
    if (hardcoded) return { name: hardcoded, tier: 3 };
  }

  return null;
}

/** Format `street, postal city` for the Odoo SO's `x_studio_werfadres` field. */
function formatWerfadres(a: {
  address: string;
  postal: string;
  city: string;
}): string {
  return `${a.address}, ${a.postal} ${a.city}`;
}

/** "YYYY-MM-DD HH:mm:ss" — the date format Odoo's create accepts. */
function formatOdooDateTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** "YYYY-MM-DD" — the date format Odoo's `end_date` accepts. */
function formatOdooDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Send the operational failure email. Recipient list: ODOO_SYNC_FAILURE_EMAIL
 * (comma-separated) → INVOICE_REMINDER_EMAIL fallback → log-only no-op.
 * Postmark / SMTP failure is caught + logged — never re-thrown — so a
 * mailer outage doesn't destroy the audit trail.
 */
async function sendFailureEmail(args: {
  assignmentId: string;
  reference: string;
  fullAddress: string;
  ownerName: string | null;
  ownerEmail: string | null;
  propertyType: string | null;
  odooContactId: number | null;
  odooOrderId: number | null;
  errorMessage: string;
}): Promise<void> {
  const recipientsRaw =
    process.env.ODOO_SYNC_FAILURE_EMAIL ?? process.env.INVOICE_REMINDER_EMAIL ?? "";
  // Basic shape check on each entry — a typo in one address shouldn't
  // silently break the whole notification flow. We log invalid entries
  // separately so the operator notices.
  const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const candidates = recipientsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const recipients = candidates.filter((s) => EMAIL_SHAPE.test(s));
  const dropped = candidates.filter((s) => !EMAIL_SHAPE.test(s));
  if (dropped.length > 0) {
    console.warn(
      `[odoo-sync] dropped invalid recipient(s) from failure email: ${dropped.join(", ")}`,
    );
  }
  if (recipients.length === 0) {
    console.warn(
      `[odoo-sync] failure email not sent (ODOO_SYNC_FAILURE_EMAIL unset or all invalid) for ${args.reference}`,
    );
    return;
  }
  try {
    const { subject, html, text } = await odooSyncFailedEmail({
      assignmentId: args.assignmentId,
      reference: args.reference,
      fullAddress: args.fullAddress,
      ownerName: args.ownerName,
      ownerEmail: args.ownerEmail,
      propertyType: args.propertyType,
      odooContactId: args.odooContactId,
      odooOrderId: args.odooOrderId,
      errorMessage: args.errorMessage,
      dashboardUrl: assignmentUrl(args.assignmentId),
    });
    await Promise.all(
      recipients.map((to) => sendEmail({ to, subject, html, text })),
    );
  } catch (err) {
    console.error(
      `[odoo-sync] failure email send threw (caught) for ${args.reference}:`,
      err,
    );
  }
}

/**
 * Sync an assignment to Odoo. Best-effort: never throws. On any internal
 * failure, writes the error to `assignment.odooSyncError`, leaves
 * `odooSyncedAt` null, sends the failure email, and returns normally.
 */
export async function syncAssignmentToOdoo(
  assignmentId: string,
  opts: { force?: boolean; trigger?: SyncTrigger } = {},
): Promise<void> {
  const trigger = opts.trigger ?? "create";

  // 3.0 — configuration / dev gate
  if (process.env.SKIP_ODOO_SYNC === "1") return;
  if (!isOdooConfigured()) {
    console.info(
      `[odoo-sync] skipped (not configured) assignment=${assignmentId}`,
    );
    return;
  }

  // 3.1 — load + idempotency
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      services: { orderBy: { serviceKey: "asc" } },
    },
  });
  if (!assignment) {
    console.warn(
      `[odoo-sync] skipped (assignment not found) assignment=${assignmentId}`,
    );
    return;
  }
  if (assignment.odooSyncedAt && !opts.force) {
    // Warning-state rows count as done; only `force` (manual retry already
    // cleared the column) re-runs them.
    return;
  }

  // Snapshot the pieces we'll need in the failure email path.
  const fullAddress = formatWerfadres(assignment);

  // Step-tracking for failure metadata: which phase threw.
  let step: "contact" | "order" | "lines" | "final" = "contact";
  let odooContactId = assignment.odooContactId;
  let odooOrderId = assignment.odooOrderId;
  const warnings: string[] = [];

  try {
    // 3.2 — contact (partner)
    if (!odooContactId) {
      // Tier-0 dedup: existing partner for this email/VAT? v1 doesn't have
      // this, so it's a strict improvement.
      const existing = await findPartnerByEmailOrVat(
        assignment.ownerEmail || null,
        assignment.ownerVatNumber || null,
      );
      if (existing) {
        console.info(
          `[odoo-sync] partner reused via dedup partner=${existing} assignment=${assignmentId}`,
        );
        odooContactId = existing;
      } else {
        const countryId = await getBelgiumCountryId();
        const created = await createPartner({
          name: assignment.ownerName || "Onbekend",
          email: assignment.ownerEmail || null,
          phone: assignment.ownerPhone || null,
          street: assignment.ownerAddress || null,
          city: assignment.ownerCity || null,
          zip: assignment.ownerPostal || null,
          country_id: countryId,
        });
        console.info(
          `[odoo-sync] partner created partner=${created} assignment=${assignmentId}`,
        );
        odooContactId = created;
      }
      // Persist immediately so a partial failure doesn't double-create on retry.
      await prisma.assignment.update({
        where: { id: assignmentId },
        data: { odooContactId },
      });
    }

    // 3.3 — sale order
    step = "order";
    if (!odooOrderId) {
      let pricelistId: number | null = null;
      if (assignment.teamId) {
        const override = await prisma.teamServiceOverride.findUnique({
          where: {
            teamId_serviceKey: {
              teamId: assignment.teamId,
              serviceKey: "asbestos",
            },
          },
          select: { odooPricelistId: true },
        });
        pricelistId = override?.odooPricelistId ?? null;
      }
      if (pricelistId === null) {
        pricelistId = await getDefaultPricelistId();
      }
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);
      const orderId = await createSaleOrder({
        partner_id: odooContactId,
        pricelist_id: pricelistId,
        x_studio_werfadres: fullAddress,
        date_order: formatOdooDateTime(now),
        end_date: formatOdooDate(endDate),
      });
      console.info(
        `[odoo-sync] order created order=${orderId} pricelist=${pricelistId ?? "default"} assignment=${assignmentId}`,
      );
      odooOrderId = orderId;
      await prisma.assignment.update({
        where: { id: assignmentId },
        data: { odooOrderId },
      });
    }

    // 3.4 — lines
    step = "lines";
    if (!assignment.odooLinesSyncedAt) {
      let lineCount = 0;
      for (const s of assignment.services) {
        // Tier 0 — pre-picked by the realtor on the create form.
        if (s.odooProductTemplateId) {
          const product = await findProductByTemplateId(s.odooProductTemplateId);
          if (!product) {
            // Real error — the realtor picked a template that no longer
            // exists in Odoo. Surface as failure (parity: v1 throws on
            // product lookup failure).
            throw new Error(
              `Odoo product template ${s.odooProductTemplateId} not found for service ${s.serviceKey}`,
            );
          }
          await addSaleOrderLine(
            odooOrderId,
            product.id,
            product.lst_price,
            assignment.quantity ?? 1,
          );
          console.info(
            `[odoo-sync] line added (tier 0) product=${product.id} service=${s.serviceKey} assignment=${assignmentId}`,
          );
          lineCount++;
          continue;
        }

        // Tier 1/2/3 — name-based resolution.
        const resolved = await resolveProductName(
          assignment.teamId,
          s.serviceKey,
          assignment.propertyType,
        );
        if (!resolved) {
          warnings.push(
            `${s.serviceKey}: woningtype "${assignment.propertyType ?? "onbekend"}" kon niet automatisch gekoppeld worden`,
          );
          continue;
        }
        console.info(
          `[odoo-sync] product resolved (tier ${resolved.tier}) name="${resolved.name}" service=${s.serviceKey} assignment=${assignmentId}`,
        );
        const product = await findProductByName(resolved.name);
        if (!product) {
          // Same hard-error semantics as v1 — name was resolved but the
          // product doesn't exist in Odoo's catalog. Operator must add it.
          throw new Error(
            `Odoo product "${resolved.name}" not found for service ${s.serviceKey} (property type ${assignment.propertyType ?? "<null>"})`,
          );
        }
        await addSaleOrderLine(
          odooOrderId,
          product.id,
          product.lst_price,
          assignment.quantity ?? 1,
        );
        console.info(
          `[odoo-sync] line added product=${product.id} service=${s.serviceKey} assignment=${assignmentId}`,
        );
        lineCount++;
      }
      await prisma.assignment.update({
        where: { id: assignmentId },
        data: { odooLinesSyncedAt: new Date() },
      });
      console.info(
        `[odoo-sync] lines complete count=${lineCount} warnings=${warnings.length} assignment=${assignmentId}`,
      );
    }

    // 3.5 — final state
    step = "final";
    const errorMessage =
      warnings.length > 0
        ? `Handmatige offerte vereist — ${warnings.join(" ")}`.slice(0, ERROR_MAX_LEN)
        : null;
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        odooSyncedAt: new Date(),
        odooSyncError: errorMessage,
        odooSyncAttempts: 0,
      },
    });
    await audit({
      verb: "assignment.odoo_synced",
      objectType: "assignment",
      objectId: assignmentId,
      metadata: {
        partnerId: odooContactId,
        orderId: odooOrderId,
        warnings,
        trigger,
      },
    });
    console.info(
      `[odoo-sync] sync complete partner=${odooContactId} order=${odooOrderId} assignment=${assignmentId}`,
    );
  } catch (err) {
    // 3.6 — failure path
    const message = err instanceof Error ? err.message : String(err);
    const truncated = message.slice(0, ERROR_MAX_LEN);
    console.error(
      `[odoo-sync] sync failed step=${step} assignment=${assignmentId}:`,
      err,
    );
    let attempts = assignment.odooSyncAttempts;
    try {
      const updated = await prisma.assignment.update({
        where: { id: assignmentId },
        data: {
          odooSyncError: truncated,
          odooSyncAttempts: { increment: 1 },
        },
        select: { odooSyncAttempts: true },
      });
      attempts = updated.odooSyncAttempts;
    } catch (dbErr) {
      console.error(
        `[odoo-sync] failed to persist sync error assignment=${assignmentId}:`,
        dbErr,
      );
    }
    await audit({
      verb: "assignment.odoo_sync_failed",
      objectType: "assignment",
      objectId: assignmentId,
      metadata: { error: truncated, step, trigger, attempts },
    });
    await sendFailureEmail({
      assignmentId,
      reference: assignment.reference,
      fullAddress,
      ownerName: assignment.ownerName || null,
      ownerEmail: assignment.ownerEmail || null,
      propertyType: assignment.propertyType,
      odooContactId,
      odooOrderId,
      errorMessage: truncated,
    });
  }
}
