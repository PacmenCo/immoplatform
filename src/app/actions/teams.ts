"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, type SessionWithUser } from "@/lib/auth";
import { canCreateTeam, canEditTeam, hasRole } from "@/lib/permissions";
import { withSession, type ActionResult } from "./_types";

// ─── Schemas ───────────────────────────────────────────────────────

const hexColor = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{3,8}$/, "Use a valid hex color, e.g. #0f172a.")
  .transform((s) => (s.startsWith("#") ? s : `#${s}`));

/** 2-letter display badge used on the team card when there's no logo image. */
const logoBadge = z
  .string()
  .trim()
  .min(1, "Pick a 1–3 character badge.")
  .max(3, "Badges are at most 3 characters.")
  .transform((s) => s.toUpperCase());

const optString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s ? s : null))
    .nullable()
    .optional();

const teamSchema = z.object({
  name: z.string().trim().min(1, "Team name is required.").max(120),
  city: optString(80),
  email: z
    .string()
    .trim()
    .email("Team email looks invalid.")
    .max(200)
    .or(z.literal(""))
    .optional()
    .transform((s) => (s ? s : null)),
  description: optString(1000),
  logo: logoBadge,
  logoColor: hexColor,

  // Legal + billing
  legalName: optString(200),
  vatNumber: optString(40),
  kboNumber: optString(40),
  iban: optString(40),
  billingEmail: z
    .string()
    .trim()
    .email("Billing email looks invalid.")
    .max(200)
    .or(z.literal(""))
    .optional()
    .transform((s) => (s ? s : null)),
  billingPhone: optString(40),
  billingAddress: optString(200),
  billingPostal: optString(20),
  billingCity: optString(80),
  billingCountry: optString(80),

  defaultClientType: z
    .enum(["owner", "firm"])
    .or(z.literal(""))
    .optional()
    .transform((v) => (v ? v : null)),
  prefersLogoOnPhotos: z.boolean(),

  // Commission
  commissionType: z
    .enum(["percentage", "fixed", "none"])
    .transform((v) => (v === "none" ? null : v))
    .nullable()
    .optional(),
  commissionValue: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z.coerce.number().int().min(0).max(100_000_00).nullable(),
  ),
});

function readTeamFormData(formData: FormData) {
  return {
    name: formData.get("name") as string,
    city: (formData.get("city") as string) || "",
    email: (formData.get("email") as string) || "",
    description: (formData.get("description") as string) || "",
    logo: (formData.get("logo") as string) || "",
    logoColor: (formData.get("logoColor") as string) || "#0f172a",
    legalName: (formData.get("legalName") as string) || "",
    vatNumber: (formData.get("vatNumber") as string) || "",
    kboNumber: (formData.get("kboNumber") as string) || "",
    iban: (formData.get("iban") as string) || "",
    billingEmail: (formData.get("billingEmail") as string) || "",
    billingPhone: (formData.get("billingPhone") as string) || "",
    billingAddress: (formData.get("billingAddress") as string) || "",
    billingPostal: (formData.get("billingPostal") as string) || "",
    billingCity: (formData.get("billingCity") as string) || "",
    billingCountry: (formData.get("billingCountry") as string) || "",
    defaultClientType: (formData.get("defaultClientType") as string) || "",
    prefersLogoOnPhotos: formData.get("prefersLogoOnPhotos") != null,
    commissionType: (formData.get("commissionType") as string) || "none",
    commissionValue: (formData.get("commissionValue") as string) || "",
  };
}

// ─── Create ────────────────────────────────────────────────────────

/**
 * Session-accepting body of `createTeam`. Exported for Vitest integration
 * tests. Returns the new team id on success; the wrapped form redirects.
 */
export async function createTeamInner(
  session: SessionWithUser,
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  if (!canCreateTeam(session)) {
    return { ok: false, error: "You don't have permission to create teams." };
  }

  const parsed = teamSchema.safeParse(readTeamFormData(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const d = parsed.data;

  // Creator becomes the initial owner. Admins can transfer afterwards via the
  // existing transferTeamOwnership flow.
  const team = await prisma.$transaction(async (tx) => {
    const t = await tx.team.create({
      data: {
        name: d.name,
        city: d.city ?? null,
        email: d.email ?? null,
        description: d.description ?? null,
        logo: d.logo,
        logoColor: d.logoColor,
        legalName: d.legalName ?? null,
        vatNumber: d.vatNumber ?? null,
        kboNumber: d.kboNumber ?? null,
        iban: d.iban ?? null,
        billingEmail: d.billingEmail ?? null,
        billingPhone: d.billingPhone ?? null,
        billingAddress: d.billingAddress ?? null,
        billingPostal: d.billingPostal ?? null,
        billingCity: d.billingCity ?? null,
        billingCountry: d.billingCountry ?? null,
        defaultClientType: d.defaultClientType ?? null,
        prefersLogoOnPhotos: d.prefersLogoOnPhotos,
        commissionType: d.commissionType ?? null,
        commissionValue: d.commissionValue ?? null,
      },
    });
    await tx.teamMember.create({
      data: {
        teamId: t.id,
        userId: session.user.id,
        teamRole: "owner",
      },
    });
    return t;
  });

  await audit({
    actorId: session.user.id,
    verb: "team.created",
    objectType: "team",
    objectId: team.id,
    metadata: { name: team.name, city: team.city },
  });

  revalidatePath("/dashboard/teams");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: team.id } };
}

export const createTeam = withSession(async (
  session: SessionWithUser,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  const result = await createTeamInner(session, undefined, formData);
  if (result.ok && result.data) redirect(`/dashboard/teams/${result.data.id}`);
  if (result.ok) return { ok: true };
  return result;
});

// ─── Update ────────────────────────────────────────────────────────

/**
 * Session-accepting body of `updateTeam`. Exported for Vitest integration
 * tests; the wrapped form below redirects on success.
 */
export async function updateTeamInner(
  session: SessionWithUser,
  teamId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await canEditTeam(session, teamId))) {
    return { ok: false, error: "You don't have permission to edit this team." };
  }

  const parsed = teamSchema.safeParse(readTeamFormData(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const d = parsed.data;

  // v1 parity: commission config lives under Admin\TeamController — realtor
  // owners can edit everything else, but only admins set commissionType /
  // commissionValue. Silently drop those fields for non-admins so a crafted
  // form submission can't overwrite them.
  const isAdmin = hasRole(session, "admin");

  await prisma.team.update({
    where: { id: teamId },
    data: {
      name: d.name,
      city: d.city ?? null,
      email: d.email ?? null,
      description: d.description ?? null,
      logo: d.logo,
      logoColor: d.logoColor,
      legalName: d.legalName ?? null,
      vatNumber: d.vatNumber ?? null,
      kboNumber: d.kboNumber ?? null,
      iban: d.iban ?? null,
      billingEmail: d.billingEmail ?? null,
      billingPhone: d.billingPhone ?? null,
      billingAddress: d.billingAddress ?? null,
      billingPostal: d.billingPostal ?? null,
      billingCity: d.billingCity ?? null,
      billingCountry: d.billingCountry ?? null,
      defaultClientType: d.defaultClientType ?? null,
      prefersLogoOnPhotos: d.prefersLogoOnPhotos,
      ...(isAdmin
        ? {
            commissionType: d.commissionType ?? null,
            commissionValue: d.commissionValue ?? null,
          }
        : {}),
    },
  });

  await audit({
    actorId: session.user.id,
    verb: "team.updated",
    objectType: "team",
    objectId: teamId,
    metadata: { name: d.name },
  });

  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath("/dashboard/teams");
  return { ok: true };
}

export const updateTeam = withSession(async (
  session: SessionWithUser,
  teamId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  const result = await updateTeamInner(session, teamId, _prev, formData);
  if (result.ok) redirect(`/dashboard/teams/${teamId}`);
  return result;
});

// ─── Delete ────────────────────────────────────────────────────────

/**
 * Blocks deletion when the team still owns any assignments. Assignment.teamId
 * is `ON DELETE SET NULL`, so without this guard, invoices and commission
 * lines would silently orphan — we'd rather refuse and force the admin to
 * reassign or delete the history first.
 */
/**
 * Session-accepting body of `deleteTeam`. Exported for Vitest integration
 * tests; consumers should use the `withSession`-wrapped form below.
 */
export async function deleteTeamInner(
  session: SessionWithUser,
  teamId: string,
): Promise<ActionResult> {
  // v1 parity: only admins can delete teams (Platform routes admin/teams
  // under role:admin; realtor-owners can edit but not destroy).
  if (!hasRole(session, "admin")) {
    return { ok: false, error: "Only admins can delete teams." };
  }

  const [team, assignmentCount] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    }),
    prisma.assignment.count({ where: { teamId } }),
  ]);
  if (!team) return { ok: false, error: "Team not found." };
  if (assignmentCount > 0) {
    return {
      ok: false,
      error: `This team has ${assignmentCount} assignment${assignmentCount === 1 ? "" : "s"} on record. Delete or reassign those first — historical teams can't be removed while history references them.`,
    };
  }

  await prisma.team.delete({ where: { id: teamId } });

  await audit({
    actorId: session.user.id,
    verb: "team.deleted",
    objectType: "team",
    objectId: teamId,
    metadata: { name: team.name },
  });

  revalidatePath("/dashboard/teams");
  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard");
  return { ok: true };
}

export const deleteTeam = withSession(deleteTeamInner);

// ─── Remove member ─────────────────────────────────────────────────

/**
 * Remove a non-owner member from a team. Owner removal goes through the
 * transfer-ownership flow instead — doing it here would leave the team
 * without an owner.
 */
/**
 * Session-accepting body of `removeTeamMember`. Exported for Vitest tests.
 */
export async function removeTeamMemberInner(
  session: SessionWithUser,
  teamId: string,
  userId: string,
): Promise<ActionResult> {
  if (!(await canEditTeam(session, teamId))) {
    return { ok: false, error: "You don't have permission to manage this team's members." };
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { teamRole: true, user: { select: { firstName: true, lastName: true } } },
  });
  if (!membership) return { ok: false, error: "That user is not on this team." };
  if (membership.teamRole === "owner") {
    return {
      ok: false,
      error: "Transfer ownership to another member before removing the current owner.",
    };
  }

  await prisma.teamMember.delete({
    where: { teamId_userId: { teamId, userId } },
  });

  await audit({
    actorId: session.user.id,
    verb: "team.member_removed",
    objectType: "team",
    objectId: teamId,
    metadata: {
      userId,
      memberName: `${membership.user.firstName} ${membership.user.lastName}`,
    },
  });

  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath("/dashboard/teams");
  revalidatePath("/dashboard/users");
  return { ok: true };
}

export const removeTeamMember = withSession(removeTeamMemberInner);

// ─── Team price list overrides ─────────────────────────────────────

/**
 * Set or replace the per-team override for one service. A zero or
 * undefined `priceCents` clears the override (falls back to Service.unitPrice
 * for future assignments). Only team owners / admins.
 *
 * Existing assignments retain their snapshotted unitPriceCents — this only
 * affects freshly-created assignments from here on.
 */
/**
 * Session-accepting body of `setTeamServiceOverride`. Exported for Vitest
 * integration tests — this is the money path (drives pricing on new rows).
 */
export async function setTeamServiceOverrideInner(
  session: SessionWithUser,
  teamId: string,
  serviceKey: string,
  priceCents: number | null,
): Promise<ActionResult> {
  // v1 parity: per-team price overrides live under Admin\TeamController —
  // route admin-only. Realtor-owners cannot change their team's prices.
  if (!hasRole(session, "admin")) {
    return { ok: false, error: "Only admins can change team price overrides." };
  }

  // Guard the service key + price value at the edge.
  const service = await prisma.service.findUnique({
    where: { key: serviceKey },
    select: { key: true },
  });
  if (!service) return { ok: false, error: "Unknown service." };

  // Explicit three-state contract:
  //   null   → clear existing override (revert to base price)
  //   0 / <0 → reject (misread as "set override to €0", likely a typo)
  //   > 0    → upsert
  if (priceCents === null) {
    await prisma.teamServiceOverride
      .delete({ where: { teamId_serviceKey: { teamId, serviceKey } } })
      .catch(() => {}); // no-op if the override never existed
    await audit({
      actorId: session.user.id,
      verb: "team.service_override_removed",
      objectType: "team",
      objectId: teamId,
      metadata: { serviceKey },
    });
  } else {
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      return {
        ok: false,
        error:
          "Price must be greater than 0. Use Reset to clear the override and fall back to the base price.",
      };
    }
    if (priceCents > 1_000_000_00) {
      return { ok: false, error: "Price looks off — use cents (e.g. 14500 for €145)." };
    }
    await prisma.teamServiceOverride.upsert({
      where: { teamId_serviceKey: { teamId, serviceKey } },
      create: { teamId, serviceKey, priceCents },
      update: { priceCents },
    });
    await audit({
      actorId: session.user.id,
      verb: "team.service_override_set",
      objectType: "team",
      objectId: teamId,
      metadata: { serviceKey, priceCents },
    });
  }

  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath(`/dashboard/teams/${teamId}/edit`);
  return { ok: true };
}

export const setTeamServiceOverride = withSession(setTeamServiceOverrideInner);

// ─── Ownership transfer ────────────────────────────────────────────

/**
 * Session-accepting body of `transferTeamOwnership`. Exported for Vitest
 * integration tests — consumers should use the wrapped form below.
 */
export async function transferTeamOwnershipInner(
  session: SessionWithUser,
  teamId: string,
  newOwnerUserId: string,
): Promise<ActionResult> {
  // v1 parity: Platform has no transfer mechanism — Team.realtor_id is only
  // set at create-time by an admin. Any post-creation ownership change has
  // to come from admin. Team-owner realtors cannot transfer on their own.
  if (!hasRole(session, "admin")) {
    return { ok: false, error: "Only admins can transfer team ownership." };
  }

  // The target must currently be a member of the team, still active, and
  // have a platform role that's eligible to own a team.
  const target = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: newOwnerUserId } },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!target) {
    return {
      ok: false,
      error:
        "That user is no longer a member of this team. Refresh the page and try again.",
    };
  }
  if (target.user.deletedAt) {
    return { ok: false, error: "That account is deactivated." };
  }
  if (!["realtor", "admin"].includes(target.user.role)) {
    return {
      ok: false,
      error:
        "Team ownership can only be transferred to a realtor or admin. Change their platform role first.",
    };
  }
  if (target.teamRole === "owner") {
    return { ok: false, error: "That user is already the team owner." };
  }

  await prisma.$transaction(async (tx) => {
    // Demote all current owners to member (handles multi-owner edge cases safely).
    await tx.teamMember.updateMany({
      where: { teamId, teamRole: "owner" },
      data: { teamRole: "member" },
    });
    // Promote the target to owner.
    await tx.teamMember.update({
      where: { teamId_userId: { teamId, userId: newOwnerUserId } },
      data: { teamRole: "owner" },
    });
  });

  await audit({
    actorId: session.user.id,
    verb: "team.ownership_transferred",
    objectType: "team",
    objectId: teamId,
    metadata: {
      newOwnerUserId,
      newOwnerName: `${target.user.firstName} ${target.user.lastName}`,
    },
  });

  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath("/dashboard/teams");
  return { ok: true };
}

export const transferTeamOwnership = withSession(transferTeamOwnershipInner);
