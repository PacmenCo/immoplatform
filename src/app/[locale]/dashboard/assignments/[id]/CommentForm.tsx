"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
import { postComment } from "@/app/actions/assignments";
import type { ActionResult } from "@/app/actions/_types";
import { useTranslateError } from "@/i18n/error";

export function CommentForm({
  assignmentId,
  authorInitials,
  authorColor,
}: {
  assignmentId: string;
  authorInitials: string;
  authorColor?: string | null;
}) {
  const t = useTranslations("dashboard.assignments.comments");
  const tErr = useTranslateError();
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    postComment,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedChanges(useFormDirty(formRef));

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex gap-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <Avatar initials={authorInitials} size="sm" color={authorColor ?? "#0f172a"} />
      <div className="flex-1">
        {state && !state.ok && (
          <p role="alert" className="mb-2 text-xs text-[var(--color-asbestos)]">
            {tErr(state.error)}
          </p>
        )}
        <textarea
          name="body"
          placeholder={t("placeholder")}
          rows={2}
          className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
          required
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="sm" loading={pending}>
            {t("submit")}
          </Button>
        </div>
      </div>
    </form>
  );
}
