"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, requireSession } from "@/lib/auth";
import type { ActionResult } from "./invites";

// ─── Helpers ───────────────────────────────────────────────────────

async function nextReference(): Promise<string> {
  // Format: ASG-YYYY-NNNN where NNNN starts at 1001 and increments.
  const year = new Date().getFullYear();
  const last = await prisma.assignment.findFirst({
    where: { reference: { startsWith: `ASG-${year}-` } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const lastNum = last ? parseInt(last.reference.split("-").pop() ?? "1000", 10) : 1000;
  return `ASG-${year}-${(lastNum + 1).toString().padStart(4, "0")}`;
}

// ─── Create ────────────────────────────────────────────────────────

const createSchema = z.object({
  address: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  postal: z.string().min(1).max(10),
  propertyType: z.string().optional(),
  constructionYear: z.coerce.number().int().optional().nullable(),
  areaM2: z.coerce.number().int().optional().nullable(),

  services: z.array(z.enum(["epc", "asbestos", "electrical", "fuel"])).min(1, "Pick at least one service."),

  ownerName: z.string().min(1).max(200),
  ownerEmail: z.string().email().optional().or(z.literal("")),
  ownerPhone: z.string().optional(),

  tenantName: z.string().optional(),
  tenantEmail: z.string().email().optional().or(z.literal("")),
  tenantPhone: z.string().optional(),

  preferredDate: z.string().optional(),
  keyPickup: z.string().optional(),
  notes: z.string().optional(),
});

export async function createAssignment(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  // Collect all checked service_* keys
  const services: string[] = [];
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("service_") && v) services.push(k.replace("service_", ""));
  }

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
  const reference = await nextReference();
  const teamId = session.activeTeamId ?? null;

  const created = await prisma.assignment.create({
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
}

// ─── Mark delivered ────────────────────────────────────────────────

export async function markAssignmentDelivered(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const a = await prisma.assignment.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Assignment not found." };
  if (a.status === "delivered" || a.status === "completed") {
    return { ok: false, error: "Already delivered." };
  }

  await prisma.assignment.update({
    where: { id },
    data: { status: "delivered", deliveredAt: new Date() },
  });
  await audit({
    actorId: session.user.id,
    verb: "assignment.delivered",
    objectType: "assignment",
    objectId: id,
  });
  revalidatePath(`/dashboard/assignments/${id}`);
  revalidatePath("/dashboard/assignments");
  return { ok: true };
}

// ─── Post comment ──────────────────────────────────────────────────

const commentSchema = z.object({
  assignmentId: z.string().min(1),
  body: z.string().min(1).max(4000),
});

export async function postComment(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = commentSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    body: (formData.get("body") as string)?.trim(),
  });
  if (!parsed.success) {
    return { ok: false, error: "Comment can't be empty." };
  }

  await prisma.assignmentComment.create({
    data: {
      assignmentId: parsed.data.assignmentId,
      authorId: session.user.id,
      body: parsed.data.body,
    },
  });
  revalidatePath(`/dashboard/assignments/${parsed.data.assignmentId}`);
  return { ok: true };
}
