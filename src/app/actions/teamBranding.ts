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
 * Team branding uploads — logo + signature images. Platform parity:
 * admin/TeamController store/update at lines 123-128 (logo) and
 * TeamController update at lines 308-318 (signature). Simpler than
 * Platform: we use immo's single-form upload pattern rather than
 * Livewire's two-step filepond intermediate — same net effect, fewer
 * moving parts.
 *
 * Both flows:
 *   1. Parse + validate the multipart File.
 *   2. Write bytes via `storage().put(key)`.
 *   3. Swap DB column (logoUrl / signatureUrl) to point at the new key.
 *   4. Best-effort delete the previous file (so we don't orphan bytes).
 *   5. Audit + revalidate.
 *
 * The version segment in each key rotates every upload (epoch-ms as base36),
 * so the serving route's `?v=` cache-bust works the same way avatar does.
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

async function uploadTeamBranding(
  session: SessionWithUser,
  teamId: string,
  kind: BrandingKind,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await canEditTeam(session, teamId))) {
    return {
      ok: false,
      error: "Only admins and team owners can change team branding.",
    };
  }
  const cfg = CONFIG[kind];
  const file = formData.get(kind);
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: `Pick a ${kind} image to upload.` };
  }
  if (file.size > cfg.maxBytes) {
    const mb = Math.round(cfg.maxBytes / (1024 * 1024));
    return { ok: false, error: `${kind[0].toUpperCase()}${kind.slice(1)} image must be ${mb} MB or smaller.` };
  }
  const mime = file.type.toLowerCase();
  const ext = cfg.mimeToExt[mime];
  if (!ext) {
    return { ok: false, error: `Use ${listFormats(cfg.mimeToExt)} for the ${kind}.` };
  }

  const store = storage();
  const version = Date.now().toString(36);
  const key = makeTeamBrandingKey({ teamId, kind, version, ext });
  const buf = Buffer.from(await file.arrayBuffer());
  await store.put(key, buf, { mimeType: mime });

  // Capture the previous key so we can reap its bytes after the DB swap.
  // If deletion fails the row already points at the new key, so the old
  // bytes are orphaned at worst — logged + moved on.
  const previous = await prisma.team.findUnique({
    where: { id: teamId },
    select: { [cfg.dbField]: true } as never,
  });
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

async function removeTeamBranding(
  session: SessionWithUser,
  teamId: string,
  kind: BrandingKind,
): Promise<ActionResult> {
  if (!(await canEditTeam(session, teamId))) {
    return {
      ok: false,
      error: "Only admins and team owners can change team branding.",
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
  return uploadTeamBranding(session, teamId, "logo", formData);
});

export const removeTeamLogo = withSession(async (
  session,
  teamId: string,
): Promise<ActionResult> => {
  return removeTeamBranding(session, teamId, "logo");
});

export const uploadTeamSignature = withSession(async (
  session,
  teamId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  return uploadTeamBranding(session, teamId, "signature", formData);
});

export const removeTeamSignature = withSession(async (
  session,
  teamId: string,
): Promise<ActionResult> => {
  return removeTeamBranding(session, teamId, "signature");
});
