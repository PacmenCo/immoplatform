/**
 * Team-branding upload constants — mirrors lib/avatar.ts for the user side.
 *
 * Both limits match Platform (2 MB). Logo accepts the broader set of formats
 * Platform does (including SVG + GIF); signature is raster-only because PDFs
 * need raster stamping and SVG is a footgun at legal-document scale.
 */

export const TEAM_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const TEAM_SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

export const TEAM_LOGO_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

export const TEAM_SIGNATURE_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

export const TEAM_LOGO_EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_LOGO_MIME_TO_EXT).map(([mime, ext]) => [ext, mime]),
);
export const TEAM_SIGNATURE_EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_SIGNATURE_MIME_TO_EXT).map(([mime, ext]) => [ext, mime]),
);

export const TEAM_LOGO_ACCEPT_ATTR = Object.keys(TEAM_LOGO_MIME_TO_EXT).join(",");
export const TEAM_SIGNATURE_ACCEPT_ATTR = Object.keys(TEAM_SIGNATURE_MIME_TO_EXT).join(",");

/**
 * Build a same-origin logo URL from the team's stored key. Returns null if
 * no logo is set. `?v=` segment pins the URL to the current version so the
 * browser cache flips on every re-upload. Mirrors `avatarImageUrl`.
 */
export function teamLogoImageUrl(team: {
  id: string;
  logoUrl: string | null;
}): string | null {
  if (!team.logoUrl) return null;
  const filename = team.logoUrl.split("/").pop() ?? "";
  const version = filename.split(".")[0] ?? "";
  return `/api/teams/${team.id}/logo?v=${encodeURIComponent(version)}`;
}

export function teamSignatureImageUrl(team: {
  id: string;
  signatureUrl: string | null;
}): string | null {
  if (!team.signatureUrl) return null;
  const filename = team.signatureUrl.split("/").pop() ?? "";
  const version = filename.split(".")[0] ?? "";
  return `/api/teams/${team.id}/signature?v=${encodeURIComponent(version)}`;
}
