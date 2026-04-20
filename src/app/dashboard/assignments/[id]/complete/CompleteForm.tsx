"use client";

import { useActionState } from "react";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ServicePill } from "@/components/ui/Badge";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { Modal } from "@/components/ui/Modal";
import { markAssignmentCompleted } from "@/app/actions/assignments";
import type { ActionResult } from "@/app/actions/_types";

type Props = {
  assignmentId: string;
  reference: string;
  services: Array<{ key: string; short: string; color: string }>;
  defaultFinishedAt: string;
  cancelHref: string;
};

export function CompleteForm({
  assignmentId,
  reference,
  services,
  defaultFinishedAt,
  cancelHref,
}: Props) {
  const boundAction = markAssignmentCompleted.bind(null, assignmentId);
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundAction, undefined);

  return (
    <Modal
      title={`Complete ${reference}`}
      description="Wrap up the inspection and move this assignment out of the active queue."
      footer={
        <>
          <Button variant="ghost" size="md" href={cancelHref}>
            Cancel
          </Button>
          <Button type="submit" size="md" form="complete-form" loading={pending}>
            Mark as completed
          </Button>
        </>
      }
    >
      <form id="complete-form" action={formAction} className="space-y-5">
        {state && !state.ok && <ErrorAlert>{state.error}</ErrorAlert>}

        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-bg-alt)] px-4 py-3">
          <span className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
            Services
          </span>
          {services.map((s) => (
            <ServicePill key={s.key} color={s.color} label={s.short} />
          ))}
        </div>

        <Field
          label="Completion notes"
          id="note"
          hint="Posts as a comment on the assignment. Optional."
        >
          <Textarea
            id="note"
            name="note"
            rows={5}
            placeholder="Everything went smoothly. Owner was on site, access was fine."
          />
        </Field>

        <Field
          label="Finished at"
          id="finishedAt"
          hint="Date and time the on-site work wrapped up."
        >
          <Input
            id="finishedAt"
            name="finishedAt"
            type="datetime-local"
            defaultValue={defaultFinishedAt}
          />
        </Field>
      </form>
    </Modal>
  );
}
