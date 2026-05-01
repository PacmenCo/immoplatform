"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

/**
 * Resolve a server-action error key to a user-facing localized string.
 *
 * Server actions return `error: "errors.<domain>.<reason>"` keys (e.g.
 * `"errors.auth.invalidCredentials"`). UI displays — toasts, inline form
 * errors, anything user-visible — funnel those keys through this hook so
 * they render in the active locale.
 *
 * Why this lives here and not inside a generic primitive (Toast, etc.):
 * the rendering primitives stay framework-agnostic; translation is an
 * explicit concern at the i18n boundary. Easier to grep for, easier to
 * mock in tests, easier to extend (e.g. add a server-side variant) without
 * touching every callsite.
 *
 * Usage:
 *   const tErr = useTranslateError();
 *   const res = await someAction();
 *   if (!res.ok) toast.error(tErr(res.error));
 *
 * Behavior:
 * - Strings starting with `"errors."` are looked up against the `errors`
 *   namespace in the catalog. Missing keys fall through to the raw key
 *   (next-intl logs a console warning in dev). Better visible-key than
 *   silent empty-string when a translator forgets to add a key.
 * - Strings not starting with `"errors."` pass through unchanged. This
 *   keeps callsites uniform — they don't need to branch on whether they
 *   know it's a key or not.
 */
export function useTranslateError(): (key: string) => string {
  const t = useTranslations("errors");
  return useCallback(
    (key: string) => {
      if (!key.startsWith("errors.")) return key;
      const subKey = key.slice("errors.".length);
      try {
        return t(subKey as Parameters<typeof t>[0]);
      } catch {
        return key;
      }
    },
    [t],
  );
}
