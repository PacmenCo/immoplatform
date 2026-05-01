"use client";

import { startTransition, useActionState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import type { ActionResult } from "@/app/actions/_types";
import { useTranslateError } from "@/i18n/error";

/**
 * Restricted edit form rendered when the viewer is a freelancer assigned
 * to the row. v1 parity (Platform/AssignmentController.php:406-439): a
 * freelancer can only change the appointment date — the server action's
 * `applyFreelancerUpdate` branch filters out everything else via
 * `FREELANCER_UPDATE_FIELDS`. The wide AssignmentForm would expose fields
 * the freelancer can't actually persist, so we render a minimal form
 * instead. Hidden `loaded-at` carries the optimistic-lock token so two
 * tabs editing the same row collide cleanly.
 */
export function FreelancerEditForm({
  action,
  initialDate,
  loadedAt,
  cancelHref,
  readOnly = false,
}: {
  action: (
    prev: ActionResult | undefined,
    formData: FormData,
  ) => Promise<ActionResult>;
  initialDate: string | null;
  loadedAt: string;
  cancelHref: string;
  /** Render the date field disabled and hide the Save button — used on
   *  terminal assignments where the action would reject any change. */
  readOnly?: boolean;
}) {
  const t = useTranslations("dashboard.assignments.freelancerEditForm");
  const tShared = useTranslations("dashboard.assignments.shared");
  const tErr = useTranslateError();
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  const fieldErrors =
    state && !state.ok && state.fields ? state.fields : undefined;

  return (
    <form
      className="px-8 py-6 max-w-xl space-y-5"
      onSubmit={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(() => {
                formAction(fd);
              });
            }
      }
    >
      <fieldset disabled={readOnly} className="contents">
        <input type="hidden" name="loaded-at" value={loadedAt} />

        {state && !state.ok && <ErrorAlert>{tErr(state.error)}</ErrorAlert>}

        <Field
          label={t("plannedDateLabel")}
          id="preferred-date"
          hint={t("plannedDateHint")}
          error={fieldErrors?.preferredDate}
        >
          <Input
            id="preferred-date"
            name="preferred-date"
            type="date"
            defaultValue={initialDate ?? ""}
          />
        </Field>

        {!readOnly && (
          <div className="flex items-center justify-end gap-2 pt-2">
            <Link
              href={cancelHref}
              className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              {tShared("cancel")}
            </Link>
            <Button type="submit" loading={pending}>
              {tShared("save")}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
