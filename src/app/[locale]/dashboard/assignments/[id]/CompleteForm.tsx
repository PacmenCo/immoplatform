"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ServicePill } from "@/components/ui/Badge";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { Modal } from "@/components/ui/Modal";
import { markAssignmentCompleted } from "@/app/actions/assignments";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
import type { ActionResult } from "@/app/actions/_types";
import { useTranslateError } from "@/i18n/error";

type Props = {
  assignmentId: string;
  reference: string;
  services: Array<{ key: string; short: string; color: string }>;
  defaultFinishedAt: string;
  /** Open/close state owned by the trigger component (AssignmentActions). */
  open: boolean;
  onClose: () => void;
};

/**
 * Triggered overlay dialog for completing an assignment. v1 parity:
 * agency-side completion is an inline action on the assignment view, not a
 * dedicated `/complete` route — Platform changes status from a dropdown on
 * the edit form, no navigation. We keep the note + custom-finishedAt fields
 * (real user value) but ditch the page navigation, so the action feels
 * proportional to its weight.
 */
export function CompleteForm({
  assignmentId,
  reference,
  services,
  defaultFinishedAt,
  open,
  onClose,
}: Props) {
  const t = useTranslations("dashboard.assignments.completeForm");
  const tShared = useTranslations("dashboard.assignments.shared");
  const tErr = useTranslateError();
  const boundAction = markAssignmentCompleted.bind(null, assignmentId);
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundAction, undefined);

  const formRef = useRef<HTMLFormElement>(null);
  // Only guard unsaved changes while the dialog is actually open — otherwise
  // the form lives offscreen and dirty-tracking would block navigation
  // for a form the user can't see. Call the hook unconditionally to satisfy
  // the rules of hooks; the gating happens on the boolean we pass downstream.
  const isDirty = useFormDirty(formRef);
  useUnsavedChanges(open && isDirty);

  // Auto-close on success. The action revalidates the page underneath, so
  // closing the dialog reveals the new "completed" badge.
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  if (!open) return null;

  return (
    <Modal
      overlay
      title={t("title", { reference })}
      description={t("description")}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            {tShared("cancel")}
          </Button>
          <Button type="submit" size="md" form="complete-form" loading={pending}>
            {t("submit")}
          </Button>
        </>
      }
    >
      <form ref={formRef} id="complete-form" action={formAction} className="space-y-5">
        {state && !state.ok && <ErrorAlert>{tErr(state.error)}</ErrorAlert>}

        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-bg-alt)] px-4 py-3">
          <span className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
            {t("servicesLabel")}
          </span>
          {services.map((s) => (
            <ServicePill key={s.key} color={s.color} label={s.short} />
          ))}
        </div>

        <Field
          label={t("notesLabel")}
          id="note"
          hint={t("notesHint")}
        >
          <Textarea
            id="note"
            name="note"
            rows={5}
            placeholder={t("notesPlaceholder")}
          />
        </Field>

        <Field
          label={t("finishedAtLabel")}
          id="finishedAt"
          hint={t("finishedAtHint")}
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
