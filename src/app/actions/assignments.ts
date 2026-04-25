"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  Prisma,
  ClientType,
  DiscountType,
  KeyPickupLocation,
  PhotographerContactPerson,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { SERVICE_KEYS, STATUS_ORDER, TERMINAL_STATUSES, isTerminalStatus } from "@/lib/mockData";
import {
  canRoleTransitionTo,
  canTransition,
  EARLY_STATUSES,
  sourcesOf,
} from "@/lib/assignmentStatus";
import type { Status } from "@/lib/mockData";
import { audit, type SessionWithUser } from "@/lib/auth";
import {
  canCancelAssignment,
  canCompleteAssignment,
  canDeleteAssignment,
  canEditAssignment,
  canReassignFreelancer,
  canSetDiscount,
  canUpdateAssignmentFields,
  canUploadToRealtorLane,
  canViewAssignment,
  eligibleFreelancerWhere,
  filterUpdateForFreelancer,
  getUserTeamIds,
  hasRole,
  role,
} from "@/lib/permissions";
import {
  MAX_DISCOUNT_FIXED_CENTS,
  MAX_DISCOUNT_PERCENTAGE_BPS,
  isDiscountType,
  resolveUnitPrices,
} from "@/lib/pricing";
import { applyCommission } from "@/lib/commission";
import { quarterOf } from "@/lib/period";
import { syncAssignmentToCalendars } from "@/lib/calendar/sync";
import {
  assignmentCancelledEmail,
  assignmentCompletedEmail,
  assignmentDateUpdatedEmail,
  assignmentDeliveredEmail,
  assignmentReassignedEmail,
  assignmentScheduledEmail,
  assignmentUnassignedEmail,
  commentPostedEmail,
  type AssignmentEmailCtx,
} from "@/lib/email";
import { notify } from "@/lib/notify";
import {
  collectAgencyRecipients,
  collectPlatformAdmins,
  loadUser,
  type Recipient,
} from "@/lib/assignment-recipients";
import { fullName } from "@/lib/format";
import { storage } from "@/lib/storage";
import { addToGoogleCalendarUrl, assignmentUrl } from "@/lib/urls";
import { uploadAssignmentFilesInner } from "./files";
import { MAX_REALTOR_FILES_AT_CREATE } from "@/lib/file-constraints";
import { NOTICE_PARAM, noticeMessage } from "@/app/dashboard/assignments/[id]/notices";
import { withSession, type ActionResult } from "./_types";


// ─── Helpers ───────────────────────────────────────────────────────

async function nextReference(): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.assignment.findFirst({
    where: { reference: { startsWith: `ASG-${year}-` } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const lastNum = last ? parseInt(last.reference.split("-").pop() ?? "1000", 10) : 1000;
  return `ASG-${year}-${(lastNum + 1).toString().padStart(4, "0")}`;
}

function ctxFromAssignment(a: {
  id: string;
  reference: string;
  address: string;
  city: string;
  postal: string;
  preferredDate?: Date | null;
  calendarDate?: Date | null;
}): AssignmentEmailCtx {
  // Only include the "Add to my calendar" CTA when the assignment has a
  // scheduled date — otherwise the link would land on an event-less row.
  const hasDate = !!(a.calendarDate ?? a.preferredDate);
  return {
    reference: a.reference,
    address: a.address,
    city: a.city,
    postal: a.postal,
    assignmentUrl: assignmentUrl(a.id),
    addToCalendarUrl: hasDate ? addToGoogleCalendarUrl(a.id) : undefined,
  };
}

type DiscountPatch = {
  discountType: DiscountType | null;
  discountValue: number | null;
  discountReason: string | null;
};

const EMPTY_DISCOUNT_PATCH: DiscountPatch = {
  discountType: null,
  discountValue: null,
  discountReason: null,
};

/**
 * Pull discount fields from a FormData. Returns null when the form did not
 * include discount inputs at all (so the caller leaves the DB unchanged).
 * Returns a clearing patch when the input is invalid, missing, or zero.
 * Percentage is stored as basis points (1500 = 15 %) and capped at 10 000;
 * fixed is stored as cents and capped at €100 000 as defense-in-depth so a
 * bad value never reaches downstream math or displays.
 */
function parseDiscountFromForm(formData: FormData): DiscountPatch | null {
  if (!formData.has("discountType")) return null;
  const rawType = (formData.get("discountType") as string) || "";
  if (!isDiscountType(rawType)) return EMPTY_DISCOUNT_PATCH;

  const rawValue = (formData.get("discountValue") as string) || "";
  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return EMPTY_DISCOUNT_PATCH;
  }

  const cap =
    rawType === "percentage" ? MAX_DISCOUNT_PERCENTAGE_BPS : MAX_DISCOUNT_FIXED_CENTS;
  const clamped = Math.min(parsedValue, cap);

  const reason = ((formData.get("discountReason") as string) || "").trim();
  return {
    discountType: rawType as DiscountType,
    discountValue: clamped,
    discountReason: reason || null,
  };
}

function isUniqueReferenceConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes("reference")
  );
}

/**
 * Optimistic-lock predicate parsed from the edit form's `loaded-at` hidden
 * field — the value is the assignment's `updatedAt` ISO string at the moment
 * the user opened the page. We hand it back to `updateMany` as part of the
 * `where` filter; if the row's `updatedAt` has moved on (someone else saved
 * in the meantime), `count` comes back 0 and we surface the stale-snapshot
 * error.
 *
 * Returns null when the form doesn't carry a `loaded-at` (older callers, or
 * forms that haven't been updated yet) — in that mode the caller falls back
 * to the previous last-write-wins behavior, so threading the lock through
 * a new client doesn't have to be all-or-nothing.
 *
 * Invalid date strings are also returned as null so a corrupted hidden
 * field never poisons every save with "stale snapshot." Loud-but-harmless
 * parse failures over silent permanent breakage.
 */
function parseLoadedAt(formData: FormData): Date | null {
  const raw = (formData.get("loaded-at") as string | null)?.trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Sentinel returned from the wide-edit transaction when the claim predicate
 * failed. Distinguishes "row went terminal between read and write" (the
 * existing best-effort guard) from "row's updatedAt moved past the form's
 * loaded-at snapshot" (new — concurrent edit).
 *
 * Mirrors the `ASSIGNMENT_TERMINAL` string-throw pattern in
 * `src/app/actions/files.ts:167` but stays in-process instead of crossing
 * the `$transaction` boundary as a thrown Error — `updateMany` doesn't
 * raise on `count === 0`, so we have a clean return-channel.
 *
 * Internal — never leaves this module.
 */
type UpdateClaimFailure = "terminal" | "stale";

/**
 * Reject preferredDate values before today (local-time start-of-day). v1
 * `AssignmentController::store` does the same via `before:today`. Empty /
 * undefined is allowed — clearing the date is fine.
 */
const futureDateSchema = z
  .string()
  .optional()
  .refine(
    (v) => {
      if (!v) return true;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d >= today;
    },
    "Preferred date can't be in the past.",
  );

// ─── Create ────────────────────────────────────────────────────────

const createSchema = z.object({
  address: z.string().trim().min(1, "Address is required.").max(200),
  city: z.string().trim().min(1, "City is required.").max(100),
  postal: z.string().trim().min(1, "Postal code is required.").max(10),
  propertyType: z.string().optional(),
  constructionYear: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z
      .coerce.number()
      .int()
      .min(1800, "Construction year must be 1800 or later.")
      .max(
        new Date().getFullYear() + 2,
        "Construction year can't be that far in the future.",
      )
      .nullable(),
  ),
  areaM2: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z
      .coerce.number()
      .int()
      .min(1, "Living area must be at least 1 m².")
      .max(100000, "Living area seems too large.")
      .nullable(),
  ),
  // Platform parity (AssignmentController.php:155): 1..10, defaults to 1.
  quantity: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z.coerce.number().int().min(1, "Quantity must be at least 1.").max(10, "Quantity can't exceed 10.").nullable(),
  ),

  services: z.array(z.enum(SERVICE_KEYS)).min(1, "Pick at least one service."),

  ownerName: z.string().trim().min(1, "Owner name is required.").max(200),
  ownerEmail: z.string().email().optional().or(z.literal("")),
  ownerPhone: z.string().trim().max(20, "Phone number is too long.").optional().or(z.literal("")),
  // Owner invoicing address + VAT + recipient type — Platform parity
  // (AssignmentController.php:162-164, 148, 151).
  ownerAddress: z.string().trim().max(255).optional().or(z.literal("")),
  ownerPostal: z.string().trim().max(20).optional().or(z.literal("")),
  ownerCity: z.string().trim().max(100).optional().or(z.literal("")),
  ownerVatNumber: z.string().trim().max(50).optional().or(z.literal("")),
  clientType: z.enum(["owner", "firm"]).optional().or(z.literal("")),

  tenantName: z.string().optional(),
  tenantEmail: z.string().email().optional().or(z.literal("")),
  tenantPhone: z.string().trim().max(50, "Phone number is too long.").optional().or(z.literal("")),

  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().trim().max(20, "Phone number is too long.").optional().or(z.literal("")),
  photographerContactPerson: z
    .enum(["realtor", "owner", "tenant"])
    .optional()
    .or(z.literal("")),
  isLargeProperty: z.boolean().optional(),

  preferredDate: futureDateSchema,
  calendarDate: z.string().optional(),
  calendarAccountEmail: z.string().email().optional().or(z.literal("")),
  // Key-pickup triple — Platform parity (AssignmentController.php:175-177).
  // location_type is strict `{'office','other'}`; address only meaningful when
  // requiresKeyPickup=true and locationType='other' (blade edit.blade.php:813).
  requiresKeyPickup: z.boolean().optional(),
  keyPickupLocationType: z.enum(["office", "other"]).optional().or(z.literal("")),
  keyPickupAddress: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().optional(),
  // Platform parity (AssignmentController.php:172, 266): optional initial
  // comment at create time → creates an AssignmentComment authored by the
  // creator. Only honored in createSchema; edits add comments via postComment.
  initialComment: z.string().max(2000).optional(),
});

/**
 * Session-accepting body of `createAssignment`. Exported so Vitest
 * integration tests can drive the action without a live cookie / request
 * context. Returns an ActionResult carrying the new assignment id on
 * success; the wrapped form below pairs it with a redirect. Consumers
 * should use the wrapped form.
 */
export async function createAssignmentInner(
  session: SessionWithUser,
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const services = Array.from(
    new Set(
      Array.from(formData.entries())
        .filter(([k, v]) => k.startsWith("service_") && v)
        .map(([k]) => k.replace("service_", "")),
    ),
  );

  const raw = {
    address: formData.get("address") as string,
    city: formData.get("city") as string,
    postal: formData.get("postal") as string,
    propertyType: (formData.get("type") as string) || undefined,
    constructionYear: formData.get("year") as string,
    areaM2: formData.get("area") as string,
    quantity: (formData.get("quantity") as string) || undefined,
    services,
    ownerName: formData.get("owner-name") as string,
    ownerEmail: (formData.get("owner-email") as string) || "",
    ownerPhone: (formData.get("owner-phone") as string) || undefined,
    ownerAddress: (formData.get("owner-address") as string) || "",
    ownerPostal: (formData.get("owner-postal") as string) || "",
    ownerCity: (formData.get("owner-city") as string) || "",
    ownerVatNumber: (formData.get("owner-vat") as string) || "",
    clientType: (formData.get("client-type") as string) || "",
    tenantName: (formData.get("tenant-name") as string) || undefined,
    tenantEmail: (formData.get("tenant-email") as string) || "",
    tenantPhone: (formData.get("tenant-phone") as string) || undefined,
    contactEmail: (formData.get("contactEmail") as string) || "",
    contactPhone: (formData.get("contactPhone") as string) || undefined,
    photographerContactPerson:
      (formData.get("photographerContactPerson") as string) || "",
    isLargeProperty: formData.get("isLargeProperty") === "on",
    preferredDate: (formData.get("preferred-date") as string) || undefined,
    calendarDate: (formData.get("calendarDate") as string) || undefined,
    calendarAccountEmail: (formData.get("calendarAccountEmail") as string) || "",
    requiresKeyPickup: formData.get("requiresKeyPickup") === "on",
    keyPickupLocationType:
      (formData.get("keyPickupLocationType") as string) || "",
    keyPickupAddress: (formData.get("keyPickupAddress") as string) || "",
    notes: (formData.get("notes") as string) || undefined,
    initialComment: ((formData.get("initial-comment") as string) || "").trim() || undefined,
  };
  // Freelancer is optional — only admin/staff may set it at create time.
  const rawFreelancerId = ((formData.get("freelancerId") as string) || "").trim();
  const freelancerId = rawFreelancerId && canReassignFreelancer(session)
    ? rawFreelancerId
    : null;
  if (freelancerId) {
    const target = await prisma.user.findFirst({
      where: { AND: [{ id: freelancerId }, eligibleFreelancerWhere()] },
      select: { id: true },
    });
    if (!target) {
      return { ok: false, error: "That user isn't an active freelancer." };
    }
  }
  // calendarDate + calendarAccountEmail are admin/staff only. Silently
  // drop them from non-privileged submissions (same pattern as discount).
  const canSetCalendarOverrides = canReassignFreelancer(session);

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const err = parsed.error.issues[0];
    return { ok: false, error: err?.message ?? "Check the form and try again." };
  }

  const d = parsed.data;

  // Realtor-lane supporting files (Platform parity:
  // assignments/create.blade.php:624-628 — `makelaar_files[]`). Counted +
  // capped here so the row never gets created when the user submits
  // beyond the per-create cap; the actual upload happens after the row is
  // committed (uploadAssignmentFilesInner needs the assignment id). Files
  // smaller than the 10-cap pass through to that helper, which re-runs
  // MIME + magic-byte + lane-permission validation.
  const makelaarFiles = formData
    .getAll("makelaar-file")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (makelaarFiles.length > MAX_REALTOR_FILES_AT_CREATE) {
    return {
      ok: false,
      error: `Up to ${MAX_REALTOR_FILES_AT_CREATE} files at a time.`,
    };
  }

  let teamId: string | null = session.activeTeamId ?? null;
  if (hasRole(session, "freelancer")) {
    return {
      ok: false,
      error: "Freelancers can't create assignments. Ask the realtor who hired you.",
    };
  }
  if (hasRole(session, "realtor")) {
    const { owned } = await getUserTeamIds(session.user.id);
    if (teamId && !owned.includes(teamId)) teamId = null; // drop if not owned
    if (!teamId) teamId = owned[0] ?? null;
    if (!teamId) {
      return {
        ok: false,
        error: "You need to own a team before you can create an assignment.",
      };
    }
  }

  // Snapshot the per-service unit price at creation time so retroactive
  // price-list changes don't alter in-flight invoices. Single batched
  // resolver keeps the snapshot internally consistent if a concurrent
  // setTeamServiceOverride fires between service keys.
  const priceMap = await resolveUnitPrices(teamId, d.services);
  const serviceLines = d.services.map((k) => ({
    serviceKey: k,
    unitPriceCents: priceMap.get(k) ?? 0,
  }));

  // Platform parity (AssignmentController.php:218-219, 129): create-time
  // defaults pull from session.user (contact email/phone) and the team's
  // `defaultClientType` when the form left those fields blank. Updates
  // don't default — respect what the user explicitly sets.
  const resolvedContactEmail = d.contactEmail || session.user.email;
  const resolvedContactPhone = d.contactPhone || session.user.phone || null;
  let resolvedClientType: ClientType | null =
    d.clientType ? (d.clientType as ClientType) : null;
  if (!resolvedClientType && teamId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { defaultClientType: true },
    });
    resolvedClientType = team?.defaultClientType ?? null;
  }

  // Retry on reference-collision — nextReference reads max+1 non-atomically,
  // so two concurrent creates can compute the same value. The unique index
  // on Assignment.reference catches it; we just try a fresh number.
  let created: Awaited<ReturnType<typeof prisma.assignment.create>> | null = null;
  let reference = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    reference = await nextReference();
    try {
      created = await prisma.assignment.create({
        data: {
          reference,
          status: "scheduled",
          address: d.address,
          city: d.city,
          postal: d.postal,
          propertyType: d.propertyType || null,
          constructionYear: d.constructionYear || null,
          areaM2: d.areaM2 || null,
          quantity: d.quantity ?? 1,
          isLargeProperty: !!d.isLargeProperty,
          preferredDate: d.preferredDate ? new Date(d.preferredDate) : null,
          calendarDate:
            canSetCalendarOverrides && d.calendarDate ? new Date(d.calendarDate) : null,
          calendarAccountEmail:
            canSetCalendarOverrides && d.calendarAccountEmail
              ? d.calendarAccountEmail
              : null,
          // Key-pickup triple — address only kept for locationType='other'
          // (Platform edit.blade.php:813 renders the textarea only then).
          requiresKeyPickup: !!d.requiresKeyPickup,
          keyPickupLocationType: d.requiresKeyPickup && d.keyPickupLocationType
            ? (d.keyPickupLocationType as KeyPickupLocation)
            : null,
          keyPickupAddress:
            d.requiresKeyPickup && d.keyPickupLocationType === "other"
              ? d.keyPickupAddress || null
              : null,
          notes: d.notes || null,
          ownerName: d.ownerName,
          ownerEmail: d.ownerEmail || null,
          ownerPhone: d.ownerPhone || null,
          ownerAddress: d.ownerAddress || null,
          ownerPostal: d.ownerPostal || null,
          ownerCity: d.ownerCity || null,
          ownerVatNumber: d.ownerVatNumber || null,
          clientType: resolvedClientType,
          tenantName: d.tenantName || null,
          tenantEmail: d.tenantEmail || null,
          tenantPhone: d.tenantPhone || null,
          contactEmail: resolvedContactEmail,
          contactPhone: resolvedContactPhone,
          photographerContactPerson: d.photographerContactPerson
            ? (d.photographerContactPerson as PhotographerContactPerson)
            : null,
          teamId,
          freelancerId,
          createdById: session.user.id,
          services: { create: serviceLines },
          ...(d.initialComment
            ? {
                comments: {
                  create: [{ authorId: session.user.id, body: d.initialComment }],
                },
              }
            : {}),
        },
      });
      break;
    } catch (err) {
      if (isUniqueReferenceConflict(err)) continue;
      throw err;
    }
  }
  if (!created) {
    return {
      ok: false,
      error: "Couldn't reserve a reference number. Try again in a moment.",
    };
  }

  await audit({
    actorId: session.user.id,
    verb: "assignment.created",
    objectType: "assignment",
    objectId: created.id,
    metadata: { reference, services: d.services },
  });

  // Realtor-lane supporting files — Platform parity
  // (AssignmentController::store @ 256-258 + processMakelaarFiles @ 852-907):
  // v1 creates the row first, then attaches files keyed by the new id. We
  // do the same by handing off to uploadAssignmentFilesInner, which already
  // owns lane-permission, MIME, magic-byte, and per-file size checks.
  //
  // Best-effort: if the upload step throws or returns ok:false, the
  // assignment row stays in place and we surface a warning so the UI can
  // tell the user to retry from the Files tab. Rolling back the row would
  // be a worse UX than asking for a re-upload — the form data is gone by
  // the time the user notices anyway.
  let fileWarning: string | undefined;
  if (makelaarFiles.length > 0) {
    const uploadFd = new FormData();
    for (const f of makelaarFiles) uploadFd.append("file", f);
    try {
      const uploadRes = await uploadAssignmentFilesInner(
        session,
        created.id,
        "realtor",
        undefined,
        uploadFd,
      );
      if (!uploadRes.ok) fileWarning = noticeMessage("files_failed");
    } catch {
      fileWarning = noticeMessage("files_failed");
    }
  }

  // Platform parity (NewAssignmentMail): fan the new assignment out to
  // every platform admin + staff so triage doesn't depend on someone
  // watching the dashboard. Scoped to admin+staff per v1, excludes the
  // actor so a staff member who created the assignment isn't self-mailed.
  const admins = await collectPlatformAdmins({ exclude: [session.user.id] });
  const createdByName = fullName(session.user);
  const addressLine = `${created.address}, ${created.postal} ${created.city}`;
  const servicesLine = d.services.join(", ");
  const createdUrl = assignmentUrl(created.id);
  await Promise.all(
    admins.map((a) =>
      notify({
        to: a,
        event: "assignment.created",
        subject: `New assignment ${reference}: ${addressLine}`,
        text:
          `A new assignment has landed on the platform.\n\n` +
          `Reference: ${reference}\n` +
          `Address: ${addressLine}\n` +
          `Services: ${servicesLine}\n` +
          `Created by: ${createdByName}\n\n` +
          `Open it: ${createdUrl}`,
      }),
    ),
  );

  await syncAssignmentToCalendars(created.id, "create");

  // Platform parity (AssignmentScheduledMail): the assignment lands in the
  // "scheduled" state with a date — notify the agency so the realtor + team
  // owner get the scheduling confirmation. Skipped when no date is set (no
  // calendar event either).
  const scheduledAt = created.calendarDate ?? created.preferredDate ?? null;
  if (scheduledAt) {
    const [agency, assignedFreelancer] = await Promise.all([
      collectAgencyRecipients({
        teamId: created.teamId,
        createdById: created.createdById,
        exclude: [session.user.id],
      }),
      loadUser(created.freelancerId),
    ]);
    const freelancerName = assignedFreelancer ? fullName(assignedFreelancer) : null;
    const ctx = ctxFromAssignment(created);
    await Promise.all(
      agency.map(async (r) =>
        notify({
          to: r,
          event: "assignment.scheduled",
          ...(await assignmentScheduledEmail({
            ...ctx,
            recipientName: r.firstName,
            scheduledAt,
            freelancerName,
          })),
        }),
      ),
    );
  }

  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard");
  return {
    ok: true,
    data: { id: created.id },
    ...(fileWarning ? { warning: fileWarning } : {}),
  };
}

export const createAssignment = withSession(async (
  session: SessionWithUser,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  const result = await createAssignmentInner(session, undefined, formData);
  if (result.ok && result.data) {
    // Forward partial-success (assignment created but file uploads failed)
    // through a query param so the detail page can flash a toast on land —
    // the form's `useActionState` value is wiped by `redirect()`, so we
    // can't rely on returning the warning from here.
    const qs = result.warning ? `?${NOTICE_PARAM}=files_failed` : "";
    redirect(`/dashboard/assignments/${result.data.id}${qs}`);
  }
  if (result.ok) return { ok: true };
  return result;
});

// ─── Mark delivered ────────────────────────────────────────────────

export const markAssignmentDelivered = withSession(async (
  session,
  id: string,
): Promise<ActionResult> => {
  const a = await prisma.assignment.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Assignment not found." };
  if (a.status === "delivered" || a.status === "completed") {
    return { ok: false, error: "Already delivered." };
  }

  if (!(await canEditAssignment(session, a))) {
    return {
      ok: false,
      error: "You don't have permission to mark this delivered.",
    };
  }

  const claim = await prisma.assignment.updateMany({
    where: { id, status: { in: sourcesOf("delivered") } },
    data: { status: "delivered", deliveredAt: new Date() },
  });
  if (claim.count === 0) {
    return {
      ok: false,
      error: "Status changed while you were away. Reload and try again.",
    };
  }

  await audit({
    actorId: session.user.id,
    verb: "assignment.delivered",
    objectType: "assignment",
    objectId: id,
    metadata: { fromStatus: a.status },
  });

  // Notify everyone on the row who didn't flip the switch: creator + team
  // owners (agency side) AND the assigned freelancer. When an admin or realtor
  // marks delivered on behalf, the freelancer should still learn that their
  // work just moved into the agency's review queue.
  const [agency, assignedFreelancer] = await Promise.all([
    collectAgencyRecipients({
      teamId: a.teamId,
      createdById: a.createdById,
      exclude: [session.user.id],
    }),
    loadUser(a.freelancerId),
  ]);
  const deliveredRecipients: Recipient[] = [...agency];
  if (assignedFreelancer && assignedFreelancer.id !== session.user.id) {
    // Avoid double-notifying if the freelancer is also the creator.
    if (!deliveredRecipients.some((r) => r.id === assignedFreelancer.id)) {
      deliveredRecipients.push(assignedFreelancer);
    }
  }
  const actorName = fullName(session.user);
  const freelancerName = assignedFreelancer ? fullName(assignedFreelancer) : null;
  await Promise.all(
    deliveredRecipients.map(async (r) =>
      notify({
        to: r,
        event: "assignment.delivered",
        ...(await assignmentDeliveredEmail({
          ...ctxFromAssignment(a),
          recipientName: r.firstName,
          actorName,
          freelancerName,
        })),
      }),
    ),
  );

  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard");
  return { ok: true };
});

// ─── Update ────────────────────────────────────────────────────────

const updateSchema = z.object({
  address: z.string().trim().min(1, "Address is required.").max(200),
  city: z.string().trim().min(1, "City is required.").max(100),
  postal: z.string().trim().min(1, "Postal code is required.").max(10),
  propertyType: z.string().optional(),
  constructionYear: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z
      .coerce.number()
      .int()
      .min(1800, "Construction year must be 1800 or later.")
      .max(
        new Date().getFullYear() + 2,
        "Construction year can't be that far in the future.",
      )
      .nullable(),
  ),
  areaM2: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z
      .coerce.number()
      .int()
      .min(1, "Living area must be at least 1 m².")
      .max(100000, "Living area seems too large.")
      .nullable(),
  ),
  // Platform parity (AssignmentController.php:155): 1..10, defaults to 1.
  quantity: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z.coerce.number().int().min(1, "Quantity must be at least 1.").max(10, "Quantity can't exceed 10.").nullable(),
  ),

  services: z.array(z.enum(SERVICE_KEYS)).min(1, "Pick at least one service."),

  ownerName: z.string().trim().min(1, "Owner name is required.").max(200),
  ownerEmail: z.string().email().optional().or(z.literal("")),
  ownerPhone: z.string().trim().max(20, "Phone number is too long.").optional().or(z.literal("")),
  // Owner invoicing address + VAT + recipient type — Platform parity
  // (AssignmentController.php:162-164, 148, 151).
  ownerAddress: z.string().trim().max(255).optional().or(z.literal("")),
  ownerPostal: z.string().trim().max(20).optional().or(z.literal("")),
  ownerCity: z.string().trim().max(100).optional().or(z.literal("")),
  ownerVatNumber: z.string().trim().max(50).optional().or(z.literal("")),
  clientType: z.enum(["owner", "firm"]).optional().or(z.literal("")),

  tenantName: z.string().optional(),
  tenantEmail: z.string().email().optional().or(z.literal("")),
  tenantPhone: z.string().trim().max(50, "Phone number is too long.").optional().or(z.literal("")),

  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().trim().max(20, "Phone number is too long.").optional().or(z.literal("")),
  photographerContactPerson: z
    .enum(["realtor", "owner", "tenant"])
    .optional()
    .or(z.literal("")),
  isLargeProperty: z.boolean().optional(),

  preferredDate: futureDateSchema,
  calendarDate: z.string().optional(),
  calendarAccountEmail: z.string().email().optional().or(z.literal("")),
  // Key-pickup triple — Platform parity (AssignmentController.php:469-471).
  requiresKeyPickup: z.boolean().optional(),
  keyPickupLocationType: z.enum(["office", "other"]).optional().or(z.literal("")),
  keyPickupAddress: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().optional(),
});

/**
 * Narrow update path used when a freelancer submits the edit form.
 * Mirrors Platform's AssignmentController.php:406-439 — accepts only
 * the appointment date (plus auto-status-on-date-change as a side-effect)
 * and defers status flips / comment-append to their dedicated actions.
 *
 * `formData` has already been passed through `filterUpdateForFreelancer`
 * before it gets here, so every untrusted key from the browser has been
 * dropped. This function treats the filtered bag as source-of-truth.
 */
async function applyFreelancerUpdate(
  session: Parameters<typeof canEditAssignment>[0],
  existing: NonNullable<Awaited<ReturnType<typeof prisma.assignment.findUnique>>>,
  formData: FormData,
): Promise<ActionResult> {
  const id = existing.id;
  const rawDate = ((formData.get("preferred-date") as string) || "").trim();
  const parsed = z
    .object({ preferredDate: futureDateSchema })
    .safeParse({ preferredDate: rawDate || undefined });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid date." };
  }

  const previousDate = existing.preferredDate;
  const newDate = parsed.data.preferredDate ? new Date(parsed.data.preferredDate) : null;
  const dateChanged =
    (previousDate?.getTime() ?? null) !== (newDate?.getTime() ?? null);
  if (!dateChanged) return { ok: true };

  // Auto-status parity with the wide path: setting a date from empty bumps
  // early-lifecycle rows to `scheduled`; clearing a date on a `scheduled`
  // row reverts to `awaiting`. Matches Platform's autoStatusForDateChange.
  const currentStatus = existing.status as Status;
  let autoStatus: Status | undefined;
  if (!previousDate && newDate && EARLY_STATUSES.has(currentStatus)) {
    autoStatus = "scheduled";
  } else if (previousDate && !newDate && currentStatus === "scheduled") {
    autoStatus = "awaiting";
  }

  // Optimistic-lock window: same shape as the wide-edit path. When the
  // form posts a `loaded-at`, narrow the claim predicate to that snapshot
  // so a concurrent edit (admin saved while the freelancer was still in
  // the form) surfaces a stale-snapshot error instead of clobbering.
  const loadedAt = parseLoadedAt(formData);
  const claim = await prisma.assignment.updateMany({
    where: {
      id,
      status: { notIn: [...TERMINAL_STATUSES] },
      ...(loadedAt ? { updatedAt: loadedAt } : {}),
    },
    data: {
      preferredDate: newDate,
      ...(autoStatus ? { status: autoStatus } : {}),
    },
  });
  if (claim.count === 0) {
    // Mirror the wide-path discrimination: with `loaded-at` and a still-
    // editable row, this is a concurrent-edit collision. Otherwise the
    // status went terminal and the existing copy still applies.
    const fresh = await prisma.assignment.findUnique({
      where: { id },
      select: { status: true },
    });
    const isTerminal = !fresh || isTerminalStatus(fresh.status);
    const failure: UpdateClaimFailure =
      !loadedAt || isTerminal ? "terminal" : "stale";
    if (failure === "stale") {
      return {
        ok: false,
        error:
          "Someone else just edited this assignment. Reload to see their changes.",
      };
    }
    return {
      ok: false,
      error: "Status changed while you were editing. Reload and try again.",
    };
  }

  await audit({
    actorId: session.user.id,
    verb: "assignment.updated",
    objectType: "assignment",
    objectId: id,
    metadata: {
      by: "freelancer",
      dateChanged: true,
      ...(autoStatus
        ? {
            autoStatusTransition: {
              from: currentStatus,
              to: autoStatus,
              trigger: previousDate ? "date_cleared" : "date_set",
            },
          }
        : {}),
    },
  });

  // Notify the agency side — creator + team — so the realtor learns the
  // freelancer rescheduled. The freelancer (=actor) is excluded.
  const dateRecipients: Recipient[] = [];
  if (existing.createdById && existing.createdById !== session.user.id) {
    const c = await loadUser(existing.createdById);
    if (c) dateRecipients.push(c);
  }
  await Promise.all(
    dateRecipients.map(async (r) =>
      notify({
        to: r,
        event: "assignment.date_updated",
        ...(await assignmentDateUpdatedEmail({
          ...ctxFromAssignment(existing),
          recipientName: r.firstName,
          previousDate,
          newDate,
        })),
      }),
    ),
  );

  await syncAssignmentToCalendars(id, "update");

  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard/assignments");
  return { ok: true };
}

/**
 * Session-accepting body of `updateAssignment`. Exported so Vitest
 * integration tests can drive the action without a live cookie / request
 * context. Returns the ActionResult that the wrapped form then pairs with
 * a `redirect` on success — consumers should use the wrapped form below.
 */
export async function updateAssignmentInner(
  session: SessionWithUser,
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Assignment not found." };
  if (existing.status === "completed" || existing.status === "cancelled") {
    return {
      ok: false,
      error: `This assignment is ${existing.status} and can no longer be edited.`,
    };
  }

  // Platform parity (AssignmentController::update @ 406-439): freelancers hit
  // the same update endpoint but on a restricted 3-field path — actual_date,
  // status_id, new_comment. Everything else in the submitted payload is
  // silently dropped. Status flips + comments already have dedicated actions
  // (changeAssignmentStatus, postComment) with their own policy gates, so
  // the only field that actually lands here is the appointment date.
  if (hasRole(session, "freelancer")) {
    if (!(await canEditAssignment(session, existing))) {
      return { ok: false, error: "You don't have permission to edit this assignment." };
    }
    const filtered = filterUpdateForFreelancer(formData);
    return applyFreelancerUpdate(session, existing, filtered);
  }

  if (!(await canUpdateAssignmentFields(session, existing))) {
    return { ok: false, error: "You don't have permission to edit this assignment." };
  }

  const services = Array.from(
    new Set(
      Array.from(formData.entries())
        .filter(([k, v]) => k.startsWith("service_") && v)
        .map(([k]) => k.replace("service_", "")),
    ),
  );

  const raw = {
    address: formData.get("address") as string,
    city: formData.get("city") as string,
    postal: formData.get("postal") as string,
    propertyType: (formData.get("type") as string) || undefined,
    constructionYear: formData.get("year") as string,
    areaM2: formData.get("area") as string,
    quantity: (formData.get("quantity") as string) || undefined,
    services,
    ownerName: formData.get("owner-name") as string,
    ownerEmail: (formData.get("owner-email") as string) || "",
    ownerPhone: (formData.get("owner-phone") as string) || undefined,
    ownerAddress: (formData.get("owner-address") as string) || "",
    ownerPostal: (formData.get("owner-postal") as string) || "",
    ownerCity: (formData.get("owner-city") as string) || "",
    ownerVatNumber: (formData.get("owner-vat") as string) || "",
    clientType: (formData.get("client-type") as string) || "",
    tenantName: (formData.get("tenant-name") as string) || undefined,
    tenantEmail: (formData.get("tenant-email") as string) || "",
    tenantPhone: (formData.get("tenant-phone") as string) || undefined,
    contactEmail: (formData.get("contactEmail") as string) || "",
    contactPhone: (formData.get("contactPhone") as string) || undefined,
    photographerContactPerson:
      (formData.get("photographerContactPerson") as string) || "",
    isLargeProperty: formData.get("isLargeProperty") === "on",
    preferredDate: (formData.get("preferred-date") as string) || undefined,
    calendarDate: (formData.get("calendarDate") as string) || undefined,
    calendarAccountEmail: (formData.get("calendarAccountEmail") as string) || "",
    requiresKeyPickup: formData.get("requiresKeyPickup") === "on",
    keyPickupLocationType:
      (formData.get("keyPickupLocationType") as string) || "",
    keyPickupAddress: (formData.get("keyPickupAddress") as string) || "",
    notes: (formData.get("notes") as string) || undefined,
  };

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    const err = parsed.error.issues[0];
    return { ok: false, error: err?.message ?? "Check the form and try again." };
  }
  const d = parsed.data;

  // Discount fields are admin/staff-only — silently ignore from others.
  const discountPatch = canSetDiscount(session)
    ? parseDiscountFromForm(formData)
    : null;

  // Freelancer assignment is admin/staff-only (Platform parity). Anyone else's
  // `freelancerId` value in the form is silently dropped.
  const canFreelancer = canReassignFreelancer(session);
  const rawFreelancerId = ((formData.get("freelancerId") as string) ?? "").trim();
  const nextFreelancerId = canFreelancer
    ? rawFreelancerId || null
    : existing.freelancerId;
  const freelancerChanged = canFreelancer && nextFreelancerId !== existing.freelancerId;
  if (freelancerChanged && nextFreelancerId) {
    const target = await prisma.user.findFirst({
      where: { AND: [{ id: nextFreelancerId }, eligibleFreelancerWhere()] },
      select: { id: true },
    });
    if (!target) {
      return { ok: false, error: "That user isn't an active freelancer." };
    }
  }

  // Resolve the final service lines, preserving existing snapshots where
  // possible so a mid-assignment edit doesn't silently re-price an
  // already-in-flight job. Only fetch new prices for newly-added services.
  const existingSvc = await prisma.assignmentService.findMany({
    where: { assignmentId: id },
    select: { serviceKey: true, unitPriceCents: true },
  });
  const existingByKey = new Map(existingSvc.map((s) => [s.serviceKey, s]));
  const newlyAdded = d.services.filter((k) => !existingByKey.has(k));
  const newPrices = newlyAdded.length
    ? await resolveUnitPrices(existing.teamId, newlyAdded)
    : new Map<string, number>();
  const nextLines = d.services.map((k) => {
    const prior = existingByKey.get(k);
    return {
      serviceKey: k,
      unitPriceCents: prior?.unitPriceCents ?? newPrices.get(k) ?? 0,
    };
  });

  const canSetCalendarOverrides = canFreelancer;

  // Platform parity (AssignmentController::autoStatusForDateChange,
  // app/Http/Controllers/AssignmentController.php:1229-1262):
  // - Setting a preferredDate on an early-lifecycle assignment auto-bumps to
  //   `scheduled` so it appears on calendars without a second save.
  // - Clearing the date on a `scheduled` assignment reverts to `awaiting`
  //   so it doesn't sit on the schedule with no when.
  const previousDate = existing.preferredDate;
  const newDate = d.preferredDate ? new Date(d.preferredDate) : null;
  const currentStatus = existing.status as Status;
  let autoStatus: Status | undefined;
  if (!previousDate && newDate && EARLY_STATUSES.has(currentStatus)) {
    autoStatus = "scheduled";
  } else if (previousDate && !newDate && currentStatus === "scheduled") {
    autoStatus = "awaiting";
  }

  // Optimistic-lock window: when the form posted a `loaded-at`, narrow the
  // claim predicate so a concurrent edit (another tab / admin saved between
  // page-load and submit) is surfaced instead of silently clobbered. When
  // the form omits `loaded-at`, the predicate falls back to terminal-only
  // (existing v1 parity behavior) — keeps callers we haven't migrated yet
  // from accidentally getting the new error path.
  const loadedAt = parseLoadedAt(formData);

  const claimed: true | UpdateClaimFailure = await prisma.$transaction(async (tx) => {
    // Optimistic guard: refuse the update if status went terminal in the
    // meantime (always) or if the row's updatedAt moved past the snapshot
    // the form was rendered from (when `loaded-at` is present). The two
    // failure modes are distinguished by a follow-up read so the caller
    // can pick the right error copy — terminal-state vs. concurrent-edit.
    const claim = await tx.assignment.updateMany({
      where: {
        id,
        status: { notIn: [...TERMINAL_STATUSES] },
        ...(loadedAt ? { updatedAt: loadedAt } : {}),
      },
      data: {
        address: d.address,
        city: d.city,
        postal: d.postal,
        propertyType: d.propertyType || null,
        constructionYear: d.constructionYear || null,
        areaM2: d.areaM2 || null,
        quantity: d.quantity ?? 1,
        isLargeProperty: !!d.isLargeProperty,
        preferredDate: d.preferredDate ? new Date(d.preferredDate) : null,
        requiresKeyPickup: !!d.requiresKeyPickup,
        keyPickupLocationType: d.requiresKeyPickup && d.keyPickupLocationType
          ? (d.keyPickupLocationType as KeyPickupLocation)
          : null,
        keyPickupAddress:
          d.requiresKeyPickup && d.keyPickupLocationType === "other"
            ? d.keyPickupAddress || null
            : null,
        notes: d.notes || null,
        ownerName: d.ownerName,
        ownerEmail: d.ownerEmail || null,
        ownerPhone: d.ownerPhone || null,
        ownerAddress: d.ownerAddress || null,
        ownerPostal: d.ownerPostal || null,
        ownerCity: d.ownerCity || null,
        ownerVatNumber: d.ownerVatNumber || null,
        clientType: d.clientType ? (d.clientType as ClientType) : null,
        tenantName: d.tenantName || null,
        tenantEmail: d.tenantEmail || null,
        tenantPhone: d.tenantPhone || null,
        contactEmail: d.contactEmail || null,
        contactPhone: d.contactPhone || null,
        photographerContactPerson: d.photographerContactPerson
          ? (d.photographerContactPerson as PhotographerContactPerson)
          : null,
        ...(canSetCalendarOverrides
          ? {
              calendarDate: d.calendarDate ? new Date(d.calendarDate) : null,
              calendarAccountEmail: d.calendarAccountEmail || null,
            }
          : {}),
        ...(freelancerChanged ? { freelancerId: nextFreelancerId } : {}),
        ...(discountPatch ?? {}),
        ...(autoStatus ? { status: autoStatus } : {}),
      },
    });
    if (claim.count === 0) {
      // Re-read inside the same tx so the two callers we discriminate on
      // (`terminal` vs `stale`) reflect the row's actual state at this
      // moment, not whatever the outer findUnique cached at function entry.
      const fresh = await tx.assignment.findUnique({
        where: { id },
        select: { status: true },
      });
      const isTerminal = !fresh || isTerminalStatus(fresh.status);
      // Without `loaded-at`, the only thing the predicate could have
      // rejected on is the terminal-status filter — preserve old behavior.
      if (!loadedAt || isTerminal) return "terminal" satisfies UpdateClaimFailure;
      return "stale" satisfies UpdateClaimFailure;
    }
    // Wipe + re-create (carries the resolved price snapshot forward).
    await tx.assignmentService.deleteMany({ where: { assignmentId: id } });
    await tx.assignmentService.createMany({
      data: nextLines.map((l) => ({
        assignmentId: id,
        serviceKey: l.serviceKey,
        unitPriceCents: l.unitPriceCents,
      })),
    });
    return true as const;
  });

  if (claimed !== true) {
    if (claimed === "stale") {
      return {
        ok: false,
        error:
          "Someone else just edited this assignment. Reload to see their changes.",
      };
    }
    return {
      ok: false,
      error: "Status changed while you were editing. Reload and try again.",
    };
  }

  await audit({
    actorId: session.user.id,
    verb: "assignment.updated",
    objectType: "assignment",
    objectId: id,
    metadata: {
      services: d.services,
      ...(autoStatus
        ? {
            autoStatusTransition: {
              from: currentStatus,
              to: autoStatus,
              trigger: previousDate ? "date_cleared" : "date_set",
            },
          }
        : {}),
    },
  });

  // If the preferredDate changed, ping the freelancer + creator so they can
  // replan. Other field edits don't warrant a notification. `previousDate`
  // and `newDate` are computed earlier for the auto-status logic.
  const dateChanged =
    (previousDate?.getTime() ?? null) !== (newDate?.getTime() ?? null);
  if (dateChanged) {
    const dateRecipients: Recipient[] = [];
    if (existing.freelancerId && existing.freelancerId !== session.user.id) {
      const f = await loadUser(existing.freelancerId);
      if (f) dateRecipients.push(f);
    }
    if (
      existing.createdById &&
      existing.createdById !== session.user.id &&
      existing.createdById !== existing.freelancerId
    ) {
      const c = await loadUser(existing.createdById);
      if (c) dateRecipients.push(c);
    }
    await Promise.all(
      dateRecipients.map(async (r) =>
        notify({
          to: r,
          event: "assignment.date_updated",
          ...(await assignmentDateUpdatedEmail({
            ...ctxFromAssignment(existing),
            recipientName: r.firstName,
            previousDate,
            newDate,
          })),
        }),
      ),
    );
  }

  if (freelancerChanged) {
    await audit({
      actorId: session.user.id,
      verb: "assignment.reassigned",
      objectType: "assignment",
      objectId: id,
      metadata: {
        freelancerId: nextFreelancerId,
        previousFreelancerId: existing.freelancerId,
      },
    });
    if (nextFreelancerId) {
      const incoming = await loadUser(nextFreelancerId);
      if (incoming) {
        await notify({
          to: incoming,
          event: "assignment.freelancer_assigned",
          ...(await assignmentReassignedEmail({
            ...ctxFromAssignment(existing),
            freelancerName: incoming.firstName,
            preferredDate: d.preferredDate ? new Date(d.preferredDate) : null,
          })),
        });
      }
    }
    if (existing.freelancerId) {
      const outgoing = await loadUser(existing.freelancerId);
      if (outgoing) {
        await notify({
          to: outgoing,
          event: "assignment.freelancer_unassigned",
          ...(await assignmentUnassignedEmail({
            ...ctxFromAssignment(existing),
            freelancerName: outgoing.firstName,
          })),
        });
      }
    }
  }

  // Re-sync calendars when ANY field embedded in the event payload moved:
  // date / address / notes / property metadata / contacts / large-property
  // flag / realtor contact / photographer contact person / calendarDate.
  // Match `src/lib/calendar/payload.ts` — if the stored event would render
  // with different content, we need to push the update.
  const nextCalendarDate =
    canSetCalendarOverrides && d.calendarDate ? new Date(d.calendarDate) : null;
  const calendarDateChanged =
    (existing.calendarDate?.getTime() ?? null) !== (nextCalendarDate?.getTime() ?? null);
  const calendarRelevantChanged =
    dateChanged ||
    calendarDateChanged ||
    existing.address !== d.address ||
    existing.city !== d.city ||
    existing.postal !== d.postal ||
    existing.propertyType !== (d.propertyType ?? null) ||
    (existing.areaM2 ?? null) !== (d.areaM2 ?? null) ||
    existing.isLargeProperty !== !!d.isLargeProperty ||
    existing.requiresKeyPickup !== !!d.requiresKeyPickup ||
    existing.keyPickupLocationType !==
      (d.requiresKeyPickup ? d.keyPickupLocationType || null : null) ||
    existing.keyPickupAddress !==
      (d.requiresKeyPickup && d.keyPickupLocationType === "other"
        ? d.keyPickupAddress || null
        : null) ||
    existing.notes !== (d.notes ?? null) ||
    existing.ownerName !== d.ownerName ||
    existing.ownerEmail !== (d.ownerEmail || null) ||
    existing.ownerPhone !== (d.ownerPhone ?? null) ||
    existing.tenantName !== (d.tenantName ?? null) ||
    existing.tenantEmail !== (d.tenantEmail || null) ||
    existing.tenantPhone !== (d.tenantPhone ?? null) ||
    existing.contactEmail !== (d.contactEmail || null) ||
    existing.contactPhone !== (d.contactPhone ?? null) ||
    existing.photographerContactPerson !== (d.photographerContactPerson || null);
  if (calendarRelevantChanged) {
    await syncAssignmentToCalendars(id, "update");
  }

  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard");
  return { ok: true };
}

export const updateAssignment = withSession(async (
  session: SessionWithUser,
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  const result = await updateAssignmentInner(session, id, _prev, formData);
  if (result.ok) redirect(`/dashboard/assignments/${id}`);
  return result;
});

// ─── Reassign freelancer ───────────────────────────────────────────

/**
 * Session-accepting body of `reassignFreelancer`. Exported so Vitest
 * integration tests can drive the action without a live cookie / request
 * context. Consumers should use the `withSession`-wrapped form below.
 */
export async function reassignFreelancerInner(
  session: SessionWithUser,
  id: string,
  freelancerId: string | null,
): Promise<ActionResult> {
  const a = await prisma.assignment.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Assignment not found." };
  if (!canReassignFreelancer(session)) {
    return { ok: false, error: "Only admins and staff can assign a freelancer." };
  }
  if (a.status === "completed" || a.status === "cancelled") {
    return {
      ok: false,
      error: `This assignment is ${a.status} and can't be reassigned.`,
    };
  }

  if (freelancerId) {
    const target = await prisma.user.findFirst({
      where: { AND: [{ id: freelancerId }, eligibleFreelancerWhere()] },
      select: { id: true },
    });
    if (!target) {
      return { ok: false, error: "That user isn't an active freelancer." };
    }
  }

  // Optimistic: predicate the update on the freelancerId we read so two
  // admins both reassigning at the same moment can't both "win." The first
  // write flips the column; the second's predicate (`freelancerId: <old>`)
  // no longer matches, count=0, surface a stale-snapshot error so the UI
  // can reload and the admin sees who landed first.
  const claim = await prisma.assignment.updateMany({
    where: {
      id,
      status: { notIn: [...TERMINAL_STATUSES] },
      freelancerId: a.freelancerId,
    },
    data: { freelancerId },
  });
  if (claim.count === 0) {
    const fresh = await prisma.assignment.findUnique({
      where: { id },
      select: { status: true, freelancerId: true },
    });
    if (!fresh || isTerminalStatus(fresh.status)) {
      return {
        ok: false,
        error: "Status changed while you were away. Reload and try again.",
      };
    }
    return {
      ok: false,
      error:
        "Someone else just reassigned this freelancer. Reload to see who's on it.",
    };
  }

  await audit({
    actorId: session.user.id,
    verb: "assignment.reassigned",
    objectType: "assignment",
    objectId: id,
    metadata: { freelancerId, previousFreelancerId: a.freelancerId },
  });

  // Notify both sides — incoming gets the new-job email, outgoing gets
  // a courtesy unassign email so they don't show up on-site expecting work.
  if (freelancerId && freelancerId !== a.freelancerId) {
    const incoming = await loadUser(freelancerId);
    if (incoming) {
      await notify({
        to: incoming,
        event: "assignment.freelancer_assigned",
        ...(await assignmentReassignedEmail({
          ...ctxFromAssignment(a),
          freelancerName: incoming.firstName,
          preferredDate: a.preferredDate,
        })),
      });
    }
  }
  if (a.freelancerId && a.freelancerId !== freelancerId) {
    const outgoing = await loadUser(a.freelancerId);
    if (outgoing) {
      await notify({
        to: outgoing,
        event: "assignment.freelancer_unassigned",
        ...(await assignmentUnassignedEmail({
          ...ctxFromAssignment(a),
          freelancerName: outgoing.firstName,
        })),
      });
    }
  }

  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard/assignments");
  return { ok: true };
}

export const reassignFreelancer = withSession(reassignFreelancerInner);

// ─── Start (scheduled → in_progress) ───────────────────────────────

export const markAssignmentInProgress = withSession(async (
  session,
  id: string,
): Promise<ActionResult> => {
  const a = await prisma.assignment.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Assignment not found." };
  if (!(await canEditAssignment(session, a))) {
    return { ok: false, error: "You don't have permission to start this." };
  }
  const claim = await prisma.assignment.updateMany({
    where: { id, status: { in: sourcesOf("in_progress") } },
    data: { status: "in_progress" },
  });
  if (claim.count === 0) {
    return {
      ok: false,
      error: `Can't start an assignment that is already ${a.status}.`,
    };
  }

  await audit({
    actorId: session.user.id,
    verb: "assignment.started",
    objectType: "assignment",
    objectId: id,
    metadata: { fromStatus: a.status },
  });

  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard/assignments");
  return { ok: true };
});

// ─── Complete (delivered → completed) ──────────────────────────────

const completeSchema = z.object({
  note: z.string().max(4000).optional(),
  finishedAt: z
    .string()
    .optional()
    .refine(
      (s) => !s || !Number.isNaN(Date.parse(s)),
      "Finished-at must be a valid date/time.",
    )
    .refine(
      (s) => !s || Date.parse(s) <= Date.now() + 60_000,
      "Finished-at can't be in the future.",
    ),
});

/**
 * Session-accepting body of `markAssignmentCompleted`. Exported so Vitest
 * integration tests can drive the action without a live cookie / request
 * context. The wrapped form below pairs it with a post-success redirect.
 */
export async function markAssignmentCompletedInner(
  session: SessionWithUser,
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const a = await prisma.assignment.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Assignment not found." };
  if (!(await canCompleteAssignment(session, a))) {
    return { ok: false, error: "You don't have permission to complete this." };
  }
  if (a.status !== "delivered") {
    return {
      ok: false,
      error: `Only delivered assignments can be completed. This one is ${a.status}.`,
    };
  }

  const parsed = completeSchema.safeParse({
    note: (formData.get("note") as string) || undefined,
    finishedAt: (formData.get("finishedAt") as string) || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid completion details.",
    };
  }

  const completedAt = parsed.data.finishedAt
    ? new Date(parsed.data.finishedAt)
    : new Date();

  // Status flip + commission apply happen in one transaction so a crash
  // between the two can't leave a completed assignment without its
  // commission line (or vice versa).
  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.assignment.updateMany({
      where: { id, status: { in: sourcesOf("completed") } },
      data: { status: "completed", completedAt },
    });
    if (claim.count === 0) return { claimed: false as const };
    if (parsed.data.note) {
      await tx.assignmentComment.create({
        data: {
          assignmentId: id,
          authorId: session.user.id,
          body: `Marked completed: ${parsed.data.note}`,
        },
      });
    }
    const commission = await applyCommission(id, tx);
    return { claimed: true as const, commission };
  });

  if (!result.claimed) {
    return {
      ok: false,
      error: "Status changed while you were away. Reload and try again.",
    };
  }

  await audit({
    actorId: session.user.id,
    verb: "assignment.completed",
    objectType: "assignment",
    objectId: id,
    metadata: { completedAt: completedAt.toISOString() },
  });

  if (result.commission) {
    await audit({
      actorId: session.user.id,
      verb: "assignment.commission_applied",
      objectType: "assignment",
      objectId: id,
      metadata: { amountCents: result.commission.amountCents },
    });
  }

  // Notify every stakeholder except the actor. Platform parity: when the
  // freelancer self-completes (markFinished at AssignmentController.php:1066)
  // Platform mails the admin/contact email; when the agency signs off,
  // Platform mails the freelancer. Rather than branching, we mail both
  // sides and exclude the actor — simpler and covers both flows.
  const [freelancer, agency] = await Promise.all([
    loadUser(a.freelancerId),
    collectAgencyRecipients({
      teamId: a.teamId,
      createdById: a.createdById,
      exclude: [session.user.id],
    }),
  ]);
  const recipients: Recipient[] = [...agency];
  if (freelancer && freelancer.id !== session.user.id) {
    if (!recipients.some((r) => r.id === freelancer.id)) {
      recipients.push(freelancer);
    }
  }
  const completedByName = fullName(session.user);
  await Promise.all(
    recipients.map(async (r) =>
      notify({
        to: r,
        event: "assignment.completed",
        ...(await assignmentCompletedEmail({
          ...ctxFromAssignment(a),
          recipientName: r.firstName,
          completedByName,
        })),
      }),
    ),
  );

  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard");
  return { ok: true };
}

export const markAssignmentCompleted = withSession(async (
  session: SessionWithUser,
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  const result = await markAssignmentCompletedInner(session, id, _prev, formData);
  if (result.ok) redirect(`/dashboard/assignments/${id}`);
  return result;
});

// ─── Cancel (non-terminal → cancelled) ─────────────────────────────

const cancelSchema = z.object({
  reason: z
    .string()
    .max(500)
    .transform((s) => s.trim())
    .optional(),
});

/**
 * Session-accepting body of `cancelAssignment`. Exported so Vitest
 * integration tests can drive the action without a live cookie / request
 * context. Consumers should use the `withSession`-wrapped form below.
 */
export async function cancelAssignmentInner(
  session: SessionWithUser,
  id: string,
  reason?: string,
): Promise<ActionResult> {
  const a = await prisma.assignment.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Assignment not found." };
  if (!(await canCancelAssignment(session, a))) {
    return { ok: false, error: "You don't have permission to cancel this." };
  }
  if (a.status === "completed" || a.status === "cancelled") {
    return { ok: false, error: `This assignment is already ${a.status}.` };
  }

  const parsed = cancelSchema.safeParse({ reason });
  if (!parsed.success) {
    return { ok: false, error: "Reason is too long (max 500 characters)." };
  }
  const trimmedReason = parsed.data.reason || null;

  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.assignment.updateMany({
      where: { id, status: { in: sourcesOf("cancelled") } },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: trimmedReason,
      },
    });
    if (claim.count === 0) return false;
    if (trimmedReason) {
      await tx.assignmentComment.create({
        data: {
          assignmentId: id,
          authorId: session.user.id,
          body: `Cancelled: ${trimmedReason}`,
        },
      });
    }
    return true;
  });

  if (!claimed) {
    return {
      ok: false,
      error: "Status changed while you were away. Reload and try again.",
    };
  }

  await audit({
    actorId: session.user.id,
    verb: "assignment.cancelled",
    objectType: "assignment",
    objectId: id,
    metadata: { fromStatus: a.status, reason: trimmedReason },
  });

  // Notify everyone on the row except the canceller: freelancer (if any) +
  // creator (if different from canceller).
  const cancelRecipients: Recipient[] = [];
  const freelancer = await loadUser(a.freelancerId);
  if (freelancer && freelancer.id !== session.user.id) cancelRecipients.push(freelancer);
  if (a.createdById && a.createdById !== session.user.id && a.createdById !== a.freelancerId) {
    const creator = await loadUser(a.createdById);
    if (creator) cancelRecipients.push(creator);
  }
  await Promise.all(
    cancelRecipients.map(async (r) =>
      notify({
        to: r,
        event: "assignment.cancelled",
        ...(await assignmentCancelledEmail({
          ...ctxFromAssignment(a),
          recipientName: r.firstName,
          cancelledByName: fullName(session.user),
          reason: trimmedReason,
        })),
      }),
    ),
  );

  await syncAssignmentToCalendars(id, "cancel");

  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard");
  return { ok: true };
}

export const cancelAssignment = withSession(cancelAssignmentInner);

// ─── Post comment ──────────────────────────────────────────────────

const commentSchema = z.object({
  assignmentId: z.string().min(1),
  body: z.string().min(1).max(4000),
});

/**
 * Session-accepting body of `postComment`. Exported for Vitest integration
 * tests — consumers should use the `withSession`-wrapped form below.
 */
export async function postCommentInner(
  session: SessionWithUser,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = commentSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    body: (formData.get("body") as string)?.trim(),
  });
  if (!parsed.success) {
    return { ok: false, error: "Comment can't be empty." };
  }

  const a = await prisma.assignment.findUnique({
    where: { id: parsed.data.assignmentId },
    select: {
      id: true,
      reference: true,
      address: true,
      city: true,
      postal: true,
      teamId: true,
      freelancerId: true,
      createdById: true,
    },
  });
  if (!a) return { ok: false, error: "Assignment not found." };
  if (!(await canViewAssignment(session, a))) {
    return { ok: false, error: "You can't comment on this assignment." };
  }

  await prisma.assignmentComment.create({
    data: {
      assignmentId: parsed.data.assignmentId,
      authorId: session.user.id,
      body: parsed.data.body,
    },
  });

  // Notify the other participants: freelancer + creator, minus the commenter.
  const commentRecipients: Recipient[] = [];
  if (a.freelancerId && a.freelancerId !== session.user.id) {
    const f = await loadUser(a.freelancerId);
    if (f) commentRecipients.push(f);
  }
  if (a.createdById && a.createdById !== session.user.id && a.createdById !== a.freelancerId) {
    const c = await loadUser(a.createdById);
    if (c) commentRecipients.push(c);
  }
  await Promise.all(
    commentRecipients.map(async (r) =>
      notify({
        to: r,
        event: "assignment.comment_posted",
        ...(await commentPostedEmail({
          ...ctxFromAssignment(a),
          recipientName: r.firstName,
          authorName: fullName(session.user),
          body: parsed.data.body,
        })),
      }),
    ),
  );

  revalidatePath(`/dashboard/assignments/${parsed.data.assignmentId}`);
  return { ok: true };
}

export const postComment = withSession(postCommentInner);

// ─── Inline status change (from the assignments list) ──────────────

/**
 * Lightweight status flip for the assignments table's inline picker. Uses
 * the shared `TRANSITIONS` graph and applies side-effects that make sense
 * without a dedicated form (stamps the *_at timestamp on first arrival,
 * applies commission on `completed`). The full lifecycle actions
 * (`markAssignmentCompleted`, `cancelAssignment`, …) remain for flows that
 * need notes, files, or cancellation reasons.
 */
const changeStatusSchema = z.object({
  to: z.enum(STATUS_ORDER),
});

const AUDIT_BY_TARGET = {
  awaiting: "assignment.updated",
  scheduled: "assignment.updated",
  in_progress: "assignment.started",
  delivered: "assignment.delivered",
  completed: "assignment.completed",
  cancelled: "assignment.cancelled",
  on_hold: "assignment.updated",
  draft: "assignment.updated",
} as const;

/**
 * Session-accepting body of `changeAssignmentStatus`. Exported so Vitest
 * integration tests can drive the action without a live cookie / request
 * context. Consumers should use the `withSession`-wrapped form below.
 */
export async function changeAssignmentStatusInner(
  session: SessionWithUser,
  id: string,
  input: { to: Status },
): Promise<ActionResult> {
  const parsed = changeStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  const target = parsed.data.to;

  const a = await prisma.assignment.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Assignment not found." };
  const fromStatus = a.status as Status;
  if (fromStatus === target) return { ok: true };

  // Role × target-status gate. Platform derives the per-role allow-list
  // from the `role_status` pivot (AssignmentController.php:400). Immo's
  // mirror lives in `ROLE_ALLOWED_STATUSES` inside assignmentStatus.ts.
  // Block BEFORE the per-row edit gate so a realtor can't e.g. flip to
  // `completed` on their own row (that's an agency action).
  if (!canRoleTransitionTo(role(session), fromStatus, target)) {
    return { ok: false, error: "Your role can't set this status." };
  }

  // The picker allows any flip, including reversing an accidental complete
  // or cancel. Transition direction still influences which audit verb and
  // which permission gate applies.
  const forward = canTransition(fromStatus, target);

  // Target-specific permission gate — "downgrading out of" completed or
  // cancelled is treated as an edit, not a completion/cancel action.
  const allowed =
    forward && target === "completed"
      ? await canCompleteAssignment(session, a)
      : forward && target === "cancelled"
        ? await canCancelAssignment(session, a)
        : await canEditAssignment(session, a);
  if (!allowed) {
    return { ok: false, error: "You don't have permission to change this status." };
  }

  // If we're leaving `completed`, verify that the commission line isn't
  // already locked inside a paid payout. Dropping it silently would make
  // the CommissionPayout.amountCents snapshot diverge from the live accrual
  // (paid > accrued) — an accounting mess. Admin must unmark the quarter
  // paid first.
  if (fromStatus === "completed" && target !== "completed") {
    const line = await prisma.assignmentCommission.findUnique({
      where: { assignmentId: id },
      select: { teamId: true, computedAt: true },
    });
    if (line) {
      const { year, quarter } = quarterOf(line.computedAt);
      const payout = await prisma.commissionPayout.findUnique({
        where: {
          teamId_year_quarter: { teamId: line.teamId, year, quarter },
        },
        select: { id: true },
      });
      if (payout) {
        return {
          ok: false,
          error: `Commission for Q${quarter} ${year} was already marked paid. Mark the quarter unpaid first, then reopen this assignment.`,
        };
      }
    }
  }

  const now = new Date();
  const data: Prisma.AssignmentUpdateInput = { status: target };
  if (target === "delivered" && !a.deliveredAt) data.deliveredAt = now;
  if (target === "completed" && !a.completedAt) data.completedAt = now;
  if (target === "cancelled" && !a.cancelledAt) data.cancelledAt = now;

  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.assignment.updateMany({
      where: { id, status: fromStatus },
      data,
    });
    if (claim.count === 0) return { claimed: false as const };

    // Leaving `completed` — drop the commission line so accruals don't
    // count an assignment that's no longer completed. Re-completing will
    // upsert a fresh one. The payout guard above has already rejected the
    // flip if the quarter was paid, so this delete is safe.
    if (fromStatus === "completed" && target !== "completed") {
      await tx.assignmentCommission.deleteMany({ where: { assignmentId: id } });
    }

    const commission =
      target === "completed" ? await applyCommission(id, tx) : null;
    return { claimed: true as const, commission };
  });

  if (!result.claimed) {
    return { ok: false, error: "Status changed while you were away. Reload and try again." };
  }

  await audit({
    actorId: session.user.id,
    verb: forward ? AUDIT_BY_TARGET[target] : "assignment.updated",
    objectType: "assignment",
    objectId: id,
    metadata: { fromStatus, toStatus: target },
  });

  if (result.commission) {
    await audit({
      actorId: session.user.id,
      verb: "assignment.commission_applied",
      objectType: "assignment",
      objectId: id,
      metadata: { amountCents: result.commission.amountCents },
    });
  }

  // Cancel calendar events when the row lands in `cancelled`. Other status
  // flips don't move the event — matches Platform's Outlook trigger set.
  if (target === "cancelled") {
    await syncAssignmentToCalendars(id, "cancel");
  }

  // Platform parity: a transition INTO "scheduled" (from draft/in_progress/
  // whatever) creates the external calendar event and fires the scheduled
  // email. sync.ts's status gate already short-circuits pushes from other
  // states, so we explicitly trigger sync + notify here only on the entry.
  if (fromStatus !== "scheduled" && target === "scheduled") {
    await syncAssignmentToCalendars(id, "update");
    const scheduledAt = a.calendarDate ?? a.preferredDate ?? null;
    if (scheduledAt) {
      const [agency, assignedFreelancer] = await Promise.all([
        collectAgencyRecipients({
          teamId: a.teamId,
          createdById: a.createdById,
          exclude: [session.user.id],
        }),
        loadUser(a.freelancerId),
      ]);
      const freelancerName = assignedFreelancer ? fullName(assignedFreelancer) : null;
      const ctx = ctxFromAssignment(a);
      await Promise.all(
        agency.map(async (r) =>
          notify({
            to: r,
            event: "assignment.scheduled",
            ...(await assignmentScheduledEmail({
              ...ctx,
              recipientName: r.firstName,
              scheduledAt,
              freelancerName,
            })),
          }),
        ),
      );
    }
  }

  revalidatePath("/dashboard/assignments");
  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export const changeAssignmentStatus = withSession(changeAssignmentStatusInner);

// ─── Delete ────────────────────────────────────────────────────────

/**
 * Platform parity (AssignmentController::destroy + AssignmentPolicy::delete):
 * admin deletes anything; staff never; freelancer never; realtor only their
 * own + only while status is not delivered/completed. Cascades via Prisma
 * onDelete: Cascade for comments, services, files, commission, and calendar
 * events. External calendar events get a best-effort cancel first so stale
 * events don't linger on Google/Outlook calendars.
 */
export const deleteAssignment = withSession(async (
  session,
  id: string,
): Promise<ActionResult> => {
  const existing = await prisma.assignment.findUnique({
    where: { id },
    select: {
      id: true,
      reference: true,
      status: true,
      teamId: true,
      freelancerId: true,
      createdById: true,
    },
  });
  if (!existing) return { ok: false, error: "Assignment not found." };
  if (!(await canDeleteAssignment(session, existing))) {
    return {
      ok: false,
      error:
        "You don't have permission to delete this assignment, or its status makes it undeletable.",
    };
  }

  // Best-effort calendar cleanup before the row is gone — after delete we
  // lose the provider event ids to unwind with.
  await syncAssignmentToCalendars(id, "cancel").catch((err) => {
    console.warn(`calendar cleanup failed for ${id}:`, err);
  });

  // Mirror Platform's Storage::disk('assignments')->deleteDirectory($id) —
  // the DB rows cascade via onDelete, but the bytes in storage are still ours
  // to remove. Single batch call on S3 (`DeleteObjects`); parallel on local fs.
  const files = await prisma.assignmentFile.findMany({
    where: { assignmentId: id },
    select: { storageKey: true },
  });
  if (files.length > 0) {
    await storage()
      .deleteMany(files.map((f) => f.storageKey))
      .catch((err) => {
        console.warn(`file cleanup failed for assignment ${id}:`, err);
      });
  }

  await prisma.assignment.delete({ where: { id } });

  await audit({
    actorId: session.user.id,
    verb: "assignment.deleted",
    objectType: "assignment",
    objectId: id,
    metadata: {
      reference: existing.reference,
      status: existing.status,
      filesDeleted: files.length,
    },
  });

  revalidatePath("/dashboard/assignments");
  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
});
