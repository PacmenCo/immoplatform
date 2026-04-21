"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SERVICE_KEYS, TERMINAL_STATUSES } from "@/lib/mockData";
import { canTransition, sourcesOf } from "@/lib/assignmentStatus";
import type { Status } from "@/lib/mockData";
import { audit } from "@/lib/auth";
import {
  canCancelAssignment,
  canCompleteAssignment,
  canEditAssignment,
  canReassignFreelancer,
  canSetDiscount,
  canUpdateAssignmentFields,
  canViewAssignment,
  eligibleFreelancerWhere,
  getUserTeamIds,
  hasRole,
} from "@/lib/permissions";
import {
  MAX_DISCOUNT_FIXED_CENTS,
  MAX_DISCOUNT_PERCENTAGE_BPS,
  isDiscountType,
  resolveUnitPrices,
} from "@/lib/pricing";
import { applyCommission } from "@/lib/commission";
import { quarterOf } from "@/lib/period";
import {
  assignmentCancelledEmail,
  assignmentCompletedEmail,
  assignmentDateUpdatedEmail,
  assignmentDeliveredEmail,
  assignmentReassignedEmail,
  assignmentUnassignedEmail,
  commentPostedEmail,
  type AssignmentEmailCtx,
} from "@/lib/email";
import { notify } from "@/lib/notify";
import {
  collectAgencyRecipients,
  loadUser,
  type Recipient,
} from "@/lib/assignment-recipients";
import { fullName } from "@/lib/format";
import { assignmentUrl } from "@/lib/urls";
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
}): AssignmentEmailCtx {
  return {
    reference: a.reference,
    address: a.address,
    city: a.city,
    postal: a.postal,
    assignmentUrl: assignmentUrl(a.id),
  };
}

type DiscountPatch = {
  discountType: string | null;
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
    discountType: rawType,
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

  services: z.array(z.enum(SERVICE_KEYS)).min(1, "Pick at least one service."),

  ownerName: z.string().trim().min(1, "Owner name is required.").max(200),
  ownerEmail: z.string().email().optional().or(z.literal("")),
  ownerPhone: z.string().optional(),

  tenantName: z.string().optional(),
  tenantEmail: z.string().email().optional().or(z.literal("")),
  tenantPhone: z.string().optional(),

  preferredDate: z.string().optional(),
  keyPickup: z.string().optional(),
  notes: z.string().optional(),
});

export const createAssignment = withSession(async (
  session,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
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
    services,
    ownerName: formData.get("owner-name") as string,
    ownerEmail: (formData.get("owner-email") as string) || "",
    ownerPhone: (formData.get("owner-phone") as string) || undefined,
    tenantName: (formData.get("tenant-name") as string) || undefined,
    tenantEmail: (formData.get("tenant-email") as string) || "",
    tenantPhone: (formData.get("tenant-phone") as string) || undefined,
    preferredDate: (formData.get("preferred-date") as string) || undefined,
    keyPickup: (formData.get("key-pickup") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
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

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const err = parsed.error.issues[0];
    return { ok: false, error: err?.message ?? "Check the form and try again." };
  }

  const d = parsed.data;

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
          preferredDate: d.preferredDate ? new Date(d.preferredDate) : null,
          keyPickup: d.keyPickup || null,
          notes: d.notes || null,
          ownerName: d.ownerName,
          ownerEmail: d.ownerEmail || null,
          ownerPhone: d.ownerPhone || null,
          tenantName: d.tenantName || null,
          tenantEmail: d.tenantEmail || null,
          tenantPhone: d.tenantPhone || null,
          teamId,
          freelancerId,
          createdById: session.user.id,
          services: { create: serviceLines },
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

  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard");
  redirect(`/dashboard/assignments/${created.id}`);
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
    deliveredRecipients.map((r) =>
      notify({
        to: r,
        event: "assignment.delivered",
        ...assignmentDeliveredEmail({
          ...ctxFromAssignment(a),
          recipientName: r.firstName,
          actorName,
          freelancerName,
        }),
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

  services: z.array(z.enum(SERVICE_KEYS)).min(1, "Pick at least one service."),

  ownerName: z.string().trim().min(1, "Owner name is required.").max(200),
  ownerEmail: z.string().email().optional().or(z.literal("")),
  ownerPhone: z.string().optional(),

  tenantName: z.string().optional(),
  tenantEmail: z.string().email().optional().or(z.literal("")),
  tenantPhone: z.string().optional(),

  preferredDate: z.string().optional(),
  keyPickup: z.string().optional(),
  notes: z.string().optional(),
});

export const updateAssignment = withSession(async (
  session,
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Assignment not found." };
  if (!(await canUpdateAssignmentFields(session, existing))) {
    return { ok: false, error: "You don't have permission to edit this assignment." };
  }
  if (existing.status === "completed" || existing.status === "cancelled") {
    return {
      ok: false,
      error: `This assignment is ${existing.status} and can no longer be edited.`,
    };
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
    services,
    ownerName: formData.get("owner-name") as string,
    ownerEmail: (formData.get("owner-email") as string) || "",
    ownerPhone: (formData.get("owner-phone") as string) || undefined,
    tenantName: (formData.get("tenant-name") as string) || undefined,
    tenantEmail: (formData.get("tenant-email") as string) || "",
    tenantPhone: (formData.get("tenant-phone") as string) || undefined,
    preferredDate: (formData.get("preferred-date") as string) || undefined,
    keyPickup: (formData.get("key-pickup") as string) || undefined,
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

  const claimed = await prisma.$transaction(async (tx) => {
    // Optimistic guard: refuse to update if status went terminal in the meantime.
    const claim = await tx.assignment.updateMany({
      where: { id, status: { notIn: [...TERMINAL_STATUSES] } },
      data: {
        address: d.address,
        city: d.city,
        postal: d.postal,
        propertyType: d.propertyType || null,
        constructionYear: d.constructionYear || null,
        areaM2: d.areaM2 || null,
        preferredDate: d.preferredDate ? new Date(d.preferredDate) : null,
        keyPickup: d.keyPickup || null,
        notes: d.notes || null,
        ownerName: d.ownerName,
        ownerEmail: d.ownerEmail || null,
        ownerPhone: d.ownerPhone || null,
        tenantName: d.tenantName || null,
        tenantEmail: d.tenantEmail || null,
        tenantPhone: d.tenantPhone || null,
        ...(freelancerChanged ? { freelancerId: nextFreelancerId } : {}),
        ...(discountPatch ?? {}),
      },
    });
    if (claim.count === 0) return false;
    // Wipe + re-create (carries the resolved price snapshot forward).
    await tx.assignmentService.deleteMany({ where: { assignmentId: id } });
    await tx.assignmentService.createMany({
      data: nextLines.map((l) => ({
        assignmentId: id,
        serviceKey: l.serviceKey,
        unitPriceCents: l.unitPriceCents,
      })),
    });
    return true;
  });

  if (!claimed) {
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
    metadata: { services: d.services },
  });

  // If the preferredDate changed, ping the freelancer + creator so they can
  // replan. Other field edits don't warrant a notification.
  const previousDate = existing.preferredDate;
  const newDate = d.preferredDate ? new Date(d.preferredDate) : null;
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
      dateRecipients.map((r) =>
        notify({
          to: r,
          event: "assignment.date_updated",
          ...assignmentDateUpdatedEmail({
            ...ctxFromAssignment(existing),
            recipientName: r.firstName,
            previousDate,
            newDate,
          }),
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
          ...assignmentReassignedEmail({
            ...ctxFromAssignment(existing),
            freelancerName: incoming.firstName,
            preferredDate: d.preferredDate ? new Date(d.preferredDate) : null,
          }),
        });
      }
    }
    if (existing.freelancerId) {
      const outgoing = await loadUser(existing.freelancerId);
      if (outgoing) {
        await notify({
          to: outgoing,
          event: "assignment.freelancer_unassigned",
          ...assignmentUnassignedEmail({
            ...ctxFromAssignment(existing),
            freelancerName: outgoing.firstName,
          }),
        });
      }
    }
  }

  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard");
  redirect(`/dashboard/assignments/${id}`);
});

// ─── Reassign freelancer ───────────────────────────────────────────

export const reassignFreelancer = withSession(async (
  session,
  id: string,
  freelancerId: string | null,
): Promise<ActionResult> => {
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

  const claim = await prisma.assignment.updateMany({
    where: { id, status: { notIn: [...TERMINAL_STATUSES] } },
    data: { freelancerId },
  });
  if (claim.count === 0) {
    return {
      ok: false,
      error: "Status changed while you were away. Reload and try again.",
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
        ...assignmentReassignedEmail({
          ...ctxFromAssignment(a),
          freelancerName: incoming.firstName,
          preferredDate: a.preferredDate,
        }),
      });
    }
  }
  if (a.freelancerId && a.freelancerId !== freelancerId) {
    const outgoing = await loadUser(a.freelancerId);
    if (outgoing) {
      await notify({
        to: outgoing,
        event: "assignment.freelancer_unassigned",
        ...assignmentUnassignedEmail({
          ...ctxFromAssignment(a),
          freelancerName: outgoing.firstName,
        }),
      });
    }
  }

  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard/assignments");
  return { ok: true };
});

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

export const markAssignmentCompleted = withSession(async (
  session,
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
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

  // Notify the freelancer that the agency signed off. The actor is the
  // realtor/admin/staff side, so no self-email check needed.
  const freelancer = await loadUser(a.freelancerId);
  if (freelancer) {
    await notify({
      to: freelancer,
      event: "assignment.completed",
      ...assignmentCompletedEmail({
        ...ctxFromAssignment(a),
        recipientName: freelancer.firstName,
        completedByName: fullName(session.user),
      }),
    });
  }

  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard");
  redirect(`/dashboard/assignments/${id}`);
});

// ─── Cancel (non-terminal → cancelled) ─────────────────────────────

const cancelSchema = z.object({
  reason: z
    .string()
    .max(500)
    .transform((s) => s.trim())
    .optional(),
});

export const cancelAssignment = withSession(async (
  session,
  id: string,
  reason?: string,
): Promise<ActionResult> => {
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
    cancelRecipients.map((r) =>
      notify({
        to: r,
        event: "assignment.cancelled",
        ...assignmentCancelledEmail({
          ...ctxFromAssignment(a),
          recipientName: r.firstName,
          cancelledByName: fullName(session.user),
          reason: trimmedReason,
        }),
      }),
    ),
  );

  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard");
  return { ok: true };
});

// ─── Post comment ──────────────────────────────────────────────────

const commentSchema = z.object({
  assignmentId: z.string().min(1),
  body: z.string().min(1).max(4000),
});

export const postComment = withSession(async (
  session,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
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
    commentRecipients.map((r) =>
      notify({
        to: r,
        event: "assignment.comment_posted",
        ...commentPostedEmail({
          ...ctxFromAssignment(a),
          recipientName: r.firstName,
          authorName: fullName(session.user),
          body: parsed.data.body,
        }),
      }),
    ),
  );

  revalidatePath(`/dashboard/assignments/${parsed.data.assignmentId}`);
  return { ok: true };
});

// ─── Inline status change (from the assignments list) ──────────────

/**
 * Lightweight status flip for the assignments table's inline picker. Uses
 * the shared `TRANSITIONS` graph and applies side-effects that make sense
 * without a dedicated form (stamps the *_at timestamp on first arrival,
 * applies commission on `completed`). The full lifecycle actions
 * (`markAssignmentCompleted`, `cancelAssignment`, …) remain for flows that
 * need notes, files, or cancellation reasons.
 */
const STATUS_VALUES = [
  "draft",
  "scheduled",
  "in_progress",
  "delivered",
  "completed",
  "cancelled",
] as const satisfies readonly Status[];

const changeStatusSchema = z.object({
  to: z.enum(STATUS_VALUES),
});

const AUDIT_BY_TARGET = {
  scheduled: "assignment.updated",
  in_progress: "assignment.started",
  delivered: "assignment.delivered",
  completed: "assignment.completed",
  cancelled: "assignment.cancelled",
  draft: "assignment.updated",
} as const;

export const changeAssignmentStatus = withSession(async (
  session,
  id: string,
  input: { to: Status },
): Promise<ActionResult> => {
  const parsed = changeStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  const target = parsed.data.to;

  const a = await prisma.assignment.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Assignment not found." };
  const fromStatus = a.status as Status;
  if (fromStatus === target) return { ok: true };

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

  revalidatePath("/dashboard/assignments");
  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
});
