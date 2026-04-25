/**
 * Shared notice contract between writers (server actions) and the reader
 * (`Notice.tsx`). Stringly-typed query-param keys are easy to typo at
 * either end — this module centralizes both the param name and the
 * message map so both ends import the same constant.
 */
export const NOTICE_PARAM = "notice" as const;

export const NOTICES = {
  files_failed: {
    kind: "warning",
    message:
      "Assignment created. Some files failed to upload — try again from the Files tab.",
  },
} as const satisfies Record<string, { kind: "warning"; message: string }>;

export type NoticeKey = keyof typeof NOTICES;

export function noticeMessage(key: NoticeKey): string {
  return NOTICES[key].message;
}
