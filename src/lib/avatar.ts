/** 2 MB — matches the settings-card copy. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const AVATAR_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const AVATAR_EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(AVATAR_MIME_TO_EXT).map(([mime, ext]) => [ext, mime]),
);

export const AVATAR_ACCEPT_ATTR = Object.keys(AVATAR_MIME_TO_EXT).join(",");

/**
 * Build a same-origin avatar URL from a user's stored key. Returns `null`
 * if the user hasn't uploaded one — callers fall back to initials.
 *
 * The `?v=` segment pins the URL to the current stored version so the
 * browser cache flips immediately after a re-upload.
 */
export function avatarImageUrl(user: {
  id: string;
  avatarUrl: string | null;
}): string | null {
  if (!user.avatarUrl) return null;
  const filename = user.avatarUrl.split("/").pop() ?? "";
  const version = filename.split(".")[0] ?? "";
  return `/api/avatars/${user.id}?v=${encodeURIComponent(version)}`;
}
