"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import type { ActionResult } from "@/app/actions/_types";

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
}: {
  action: (
    prev: ActionResult | undefined,
    formData: FormData,
  ) => Promise<ActionResult>;
  initialDate: string | null;
  loadedAt: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  return (
    <form className="px-8 py-6 max-w-xl space-y-5" action={formAction}>
      <input type="hidden" name="loaded-at" value={loadedAt} />

      {state && !state.ok && <ErrorAlert>{state.error}</ErrorAlert>}

      <Field
        label="Planned date"
        id="preferred-date"
        hint="Set or change the appointment date. Saving with a date promotes an awaiting assignment to scheduled; clearing it on a scheduled row reverts to awaiting."
      >
        <Input
          id="preferred-date"
          name="preferred-date"
          type="date"
          defaultValue={initialDate ?? ""}
        />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Link
          href={cancelHref}
          className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          Cancel
        </Link>
        <Button type="submit" loading={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}
