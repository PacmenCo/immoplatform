"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SERVICE_KEYS, TERMINAL_STATUSES } from "@/lib/mockData";
import { sourcesOf } from "@/lib/assignmentStatus";
import { audit } from "@/lib/auth";
import {
  canCancelAssignment,
  canCompleteAssignment,
  canEditAssignment,
  canReassignFreelancer,
  canUpdateAssignmentFields,
  canViewAssignment,
  eligibleFreelancerWhere,
  getUserTeamIds,
  hasRole,
} from "@/lib/permissions";
import {
  assignmentCancelledEmail,
  assignmentCompletedEmail,
  assignmentDateUpdatedEmail,
  assignmentDeliveredEmail,
  assignmentReassignedEmail,
  assignmentScheduledEmail,
  commentPostedEmail,
} from "@/lib/email";
import { notify } from "@/lib/notify";
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

function assignmentUrl(id: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/dashboard/assignments/${id}`;
}

/** Shape notify() needs + every template's assignment context. */
type AssignmentEmailSeed = {
  reference: string;
  address: string;
  city: string;
  postal: string;
  assignmentUrl: string;
};

function seedFromAssignment(a: {
  id: string;
  reference: string;
  address: string;
  city: string;
  postal: string;
}): AssignmentEmailSeed {
  return {
    reference: a.reference,
    address: a.address,
    city: a.city,
    postal: a.postal,
    assignmentUrl: assignmentUrl(a.id),
  };
}

function fullName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`;
}

type Recipient = {
  id: string;
  email: string;
  emailPrefs: string | null;
  firstName: string;
  lastName: string;
};

/**
 * Collect the "agency side" humans who should be pinged about an assignment:
 * the creator + all team owners. Deduplicated, excluding IDs in `exclude`
 * (typically the actor so they don't email themselves).
 */
async function collectAgencyRecipients(opts: {
  teamId: string | null;
  createdById: string | null;
  exclude: string[];
}): Promise<Recipient[]> {
  const excludeSet = new Set(opts.exclude);
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        opts.createdById ? { id: opts.createdById } : {},
        opts.teamId
          ? {
              memberships: {
                some: { teamId: opts.teamId, teamRole: "owner" },
              },
            }
          : {},
      ].filter((c) => Object.keys(c).length > 0),
    },
    select: {
      id: true,
      email: true,
      emailPrefs: true,
      firstName: true,
      lastName: true,
    },
  });
  return users.filter((u) => !excludeSet.has(u.id));
}

async function loadUser(id: string | null): Promise<Recipient | null> {
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      emailPrefs: true,
      firstName: true,
      lastName: true,
    },
  });
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
          createdById: session.user.id,
          services: {
            create: d.services.map((k) => ({ serviceKey: k })),
          },
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

  // Notify the agency side — creator + team owner (dedup + exclude the actor).
  const deliveredRecipients = await collectAgencyRecipients({
    teamId: a.teamId,
    createdById: a.createdById,
    exclude: [session.user.id],
  });
  const freelancerActor =
    a.freelancerId === session.user.id
      ? await prisma.user.findUnique({
          where: { id: a.freelancerId },
          select: { firstName: true, lastName: true },
        })
      : null;
  const freelancerName = freelancerActor
    ? fullName(freelancerActor)
    : `${session.user.firstName} ${session.user.lastName}`;
  for (const r of deliveredRecipients) {
    await notify({
      to: r,
      event: "assignment.delivered",
      ...assignmentDeliveredEmail({
        ...seedFromAssignment(a),
        recipientName: r.firstName,
        freelancerName,
      }),
    });
  }

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
      },
    });
    if (claim.count === 0) return false;
    // Wipe + re-create is simpler than diffing on 4 service rows.
    await tx.assignmentService.deleteMany({ where: { assignmentId: id } });
    await tx.assignmentService.createMany({
      data: d.services.map((k) => ({ assignmentId: id, serviceKey: k })),
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
    for (const r of dateRecipients) {
      await notify({
        to: r,
        event: "assignment.date_updated",
        ...assignmentDateUpdatedEmail({
          ...seedFromAssignment(existing),
          recipientName: r.firstName,
          previousDate,
          newDate,
        }),
      });
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
  if (!(await canReassignFreelancer(session, a))) {
    return { ok: false, error: "You don't have permission to reassign this." };
  }
  if (a.status === "completed" || a.status === "cancelled") {
    return {
      ok: false,
      error: `This assignment is ${a.status} and can't be reassigned.`,
    };
  }

  if (freelancerId) {
    // Verify the target is both an active freelancer AND within the caller's
    // visible roster — prevents assigning a freelancer from another agency.
    const target = await prisma.user.findFirst({
      where: {
        AND: [{ id: freelancerId }, await eligibleFreelancerWhere(session)],
      },
      select: { id: true },
    });
    if (!target) {
      return {
        ok: false,
        error: "That freelancer isn't available to your team.",
      };
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

  // Notify the incoming freelancer. Outgoing gets a silent unassign today —
  // product decision to revisit once we have a "dropout" / rebook flow.
  if (freelancerId && freelancerId !== a.freelancerId) {
    const newFreelancer = await prisma.user.findUnique({
      where: { id: freelancerId },
      select: { email: true, emailPrefs: true, firstName: true, lastName: true },
    });
    if (newFreelancer) {
      await notify({
        to: newFreelancer,
        event: "assignment.freelancer_reassigned",
        ...assignmentReassignedEmail({
          ...seedFromAssignment(a),
          freelancerName: newFreelancer.firstName,
          preferredDate: a.preferredDate,
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

  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.assignment.updateMany({
      where: { id, status: { in: sourcesOf("completed") } },
      data: { status: "completed", completedAt },
    });
    if (claim.count === 0) return false;
    if (parsed.data.note) {
      await tx.assignmentComment.create({
        data: {
          assignmentId: id,
          authorId: session.user.id,
          body: `Marked completed: ${parsed.data.note}`,
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
    verb: "assignment.completed",
    objectType: "assignment",
    objectId: id,
    metadata: { completedAt: completedAt.toISOString() },
  });

  // Notify the freelancer that the agency signed off. The actor is the
  // realtor/admin/staff side, so no self-email check needed.
  const freelancer = await loadUser(a.freelancerId);
  if (freelancer) {
    await notify({
      to: freelancer,
      event: "assignment.completed",
      ...assignmentCompletedEmail({
        ...seedFromAssignment(a),
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
  for (const r of cancelRecipients) {
    await notify({
      to: r,
      event: "assignment.cancelled",
      ...assignmentCancelledEmail({
        ...seedFromAssignment(a),
        recipientName: r.firstName,
        cancelledByName: fullName(session.user),
        reason: trimmedReason,
      }),
    });
  }

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
  for (const r of commentRecipients) {
    await notify({
      to: r,
      event: "assignment.comment_posted",
      ...commentPostedEmail({
        ...seedFromAssignment(a),
        recipientName: r.firstName,
        authorName: fullName(session.user),
        body: parsed.data.body,
      }),
    });
  }

  revalidatePath(`/dashboard/assignments/${parsed.data.assignmentId}`);
  return { ok: true };
});
