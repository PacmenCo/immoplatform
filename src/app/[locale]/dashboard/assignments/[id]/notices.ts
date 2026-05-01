/**
 * Shared notice contract between writers (server actions) and the reader
 * (`Notice.tsx`). Stringly-typed query-param keys are easy to typo at
 * either end — this module centralizes both the param name and the
 * translation key so both ends import the same constant.
 *
 * The actual message strings live in the i18n catalog under
 * `dashboard.assignments.notices.*` — `Notice.tsx` resolves them via the
 * `t()` lookup at render time.
 */
export const NOTICE_PARAM = "notice" as const;

export const NOTICES = {
  files_failed: {
    kind: "warning",
    translationKey: "filesFailed",
  },
} as const satisfies Record<
  string,
  { kind: "warning"; translationKey: string }
>;

export type NoticeKey = keyof typeof NOTICES;

/**
 * Compatibility helper for server actions that surfaced a notice via a
 * truthy `warning` field on `ActionResult`. We now resolve the actual
 * user-facing string via `next-intl` at render time, so this just returns
 * the translation key — callers only check it for truthiness.
 */
export function noticeMessage(key: NoticeKey): string {
  return `dashboard.assignments.notices.${NOTICES[key].translationKey}`;
}
