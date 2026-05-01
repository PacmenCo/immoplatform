"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, type SessionWithUser } from "@/lib/auth";
import { canEditTeam } from "@/lib/permissions";
import { makeTeamBrandingKey, storage } from "@/lib/storage";
import {
  TEAM_LOGO_MAX_BYTES,
  TEAM_LOGO_MIME_TO_EXT,
  TEAM_SIGNATURE_MAX_BYTES,
  TEAM_SIGNATURE_MIME_TO_EXT,
} from "@/lib/teamBranding";
import { withSession, type ActionResult } from "./_types";

/** Friendly format names for error messages — "image/svg+xml" → "SVG". */
const MIME_DISPLAY_NAME: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WebP",
  "image/svg+xml": "SVG",
  "image/gif": "GIF",
};

function listFormats(mimeToExt: Record<string, string>): string {
  const names = Object.keys(mimeToExt).map((m) => MIME_DISPLAY_NAME[m] ?? m);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
}

/**
 * Team branding uploads — logo + signature images. The version segment in
 * each storage key rotates per upload (epoch-ms as base36) so the serving
 * route's `?v=` cache-bust works the same way avatars do.
 */

type BrandingKind = "logo" | "signature";

const CONFIG: Record<
  BrandingKind,
  {
    maxBytes: number;
    mimeToExt: Record<string, string>;
    dbField: "logoUrl" | "signatureUrl";
    auditKind: string;
  }
> = {
  logo: {
    maxBytes: TEAM_LOGO_MAX_BYTES,
    mimeToExt: TEAM_LOGO_MIME_TO_EXT,
    dbField: "logoUrl",
    auditKind: "logo",
  },
  signature: {
    maxBytes: TEAM_SIGNATURE_MAX_BYTES,
    mimeToExt: TEAM_SIGNATURE_MIME_TO_EXT,
    dbField: "signatureUrl",
    auditKind: "signature",
  },
};

/**
 * Exported for Vitest tests — the four public wrappers (upload/remove ×
 * logo/signature) all delegate here; testing this once covers all four paths.
 */
export async function uploadTeamBrandingInner(
  session: SessionWithUser,
  teamId: string,
  kind: BrandingKind,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await canEditTeam(session, teamId))) {
    return {
      ok: false,
      error: "errors.team.brandingOwnersOnly",
    };
  }
  const cfg = CONFIG[kind];
  const file = formData.get(kind);
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "errors.profile.pickBrandingImage" };
  }
  if (file.size > cfg.maxBytes) {
    const mb = Math.round(cfg.maxBytes / (1024 * 1024));
    return { ok: false, error: "errors.profile.brandingImageTooLarge" };
  }
  const mime = file.type.toLowerCase();
  const ext = cfg.mimeToExt[mime];
  if (!ext) {
    return { ok: false, error: "errors.profile.brandingImageWrongFormat" };
  }

  const store = storage();
  const version = Date.now().toString(36);
  const key = makeTeamBrandingKey({ teamId, kind, version, ext });
  const buf = Buffer.from(await file.arrayBuffer());

  // Upload bytes and read the prior key in parallel; the DB swap has to wait
  // for the put (don't point the column at missing bytes) but the prior-key
  // lookup is independent.
  const [, previous] = await Promise.all([
    store.put(key, buf, { mimeType: mime }),
    prisma.team.findUnique({
      where: { id: teamId },
      select: { [cfg.dbField]: true } as never,
    }),
  ]);
  const prevKey = (previous as Record<string, string | null> | null)?.[cfg.dbField] ?? null;

  await prisma.team.update({
    where: { id: teamId },
    data: { [cfg.dbField]: key },
  });
  if (prevKey && prevKey !== key) {
    await store.delete(prevKey).catch((err) => {
      console.warn(`${kind} cleanup failed for ${prevKey}:`, err);
    });
  }

  await audit({
    actorId: session.user.id,
    verb: "team.updated",
    objectType: "team",
    objectId: teamId,
    metadata: { kind: cfg.auditKind, action: "uploaded", sizeBytes: file.size, mime },
  });

  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath(`/dashboard/teams/${teamId}/edit`);
  revalidatePath("/dashboard/teams");
  return { ok: true };
}

/** Exported for Vitest tests alongside `uploadTeamBrandingInner`. */
export async function removeTeamBrandingInner(
  session: SessionWithUser,
  teamId: string,
  kind: BrandingKind,
): Promise<ActionResult> {
  if (!(await canEditTeam(session, teamId))) {
    return {
      ok: false,
      error: "errors.team.brandingOwnersOnly",
    };
  }
  const cfg = CONFIG[kind];
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { [cfg.dbField]: true } as never,
  });
  const currentKey = (team as Record<string, string | null> | null)?.[cfg.dbField] ?? null;
  if (!currentKey) return { ok: true };

  const store = storage();
  await prisma.team.update({
    where: { id: teamId },
    data: { [cfg.dbField]: null },
  });
  await store.delete(currentKey).catch((err) => {
    console.warn(`${kind} cleanup failed for ${currentKey}:`, err);
  });

  await audit({
    actorId: session.user.id,
    verb: "team.updated",
    objectType: "team",
    objectId: teamId,
    metadata: { kind: cfg.auditKind, action: "removed" },
  });

  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath(`/dashboard/teams/${teamId}/edit`);
  revalidatePath("/dashboard/teams");
  return { ok: true };
}

// ─── Public wrappers (bind teamId + kind via useActionState or direct call) ──

export const uploadTeamLogo = withSession(async (
  session,
  teamId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  return uploadTeamBrandingInner(session, teamId, "logo", formData);
});

export const removeTeamLogo = withSession(async (
  session,
  teamId: string,
): Promise<ActionResult> => {
  return removeTeamBrandingInner(session, teamId, "logo");
});

export const uploadTeamSignature = withSession(async (
  session,
  teamId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  return uploadTeamBrandingInner(session, teamId, "signature", formData);
});

export const removeTeamSignature = withSession(async (
  session,
  teamId: string,
): Promise<ActionResult> => {
  return removeTeamBrandingInner(session, teamId, "signature");
});
