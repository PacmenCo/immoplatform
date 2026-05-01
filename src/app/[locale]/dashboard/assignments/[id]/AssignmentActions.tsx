"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { Modal } from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/Input";
import { IconCheck, IconPlay, IconX } from "@/components/ui/Icons";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { isTerminalStatus } from "@/lib/mockData";
import {
  cancelAssignment,
  markAssignmentDelivered,
  markAssignmentInProgress,
} from "@/app/actions/assignments";
import { CompleteForm } from "./CompleteForm";
import { useTranslateError } from "@/i18n/error";

type Props = {
  assignmentId: string;
  reference: string;
  status: string;
  canStart: boolean;
  canDeliver: boolean;
  canUpdateFields: boolean;
  canComplete: boolean;
  canCancel: boolean;
  /** Service summary for the complete dialog. Computed in the page so the
   *  client component doesn't re-fetch.  */
  completeServices: Array<{ key: string; short: string; color: string }>;
  /** Pre-formatted local datetime-string for the dialog's "Finished at" field. */
  defaultFinishedAt: string;
};

export function AssignmentActions({
  assignmentId,
  reference,
  status,
  canStart,
  canDeliver,
  canUpdateFields,
  canComplete,
  canCancel,
  completeServices,
  defaultFinishedAt,
}: Props) {
  const t = useTranslations("dashboard.assignments.actions");
  const tErr = useTranslateError();
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Guard the typed cancellation reason — losing it would force the user
  // to write it again. Only active while the modal is open.
  useUnsavedChanges(cancelOpen && cancelReason.trim().length > 0);

  function runStart() {
    setActionError(null);
    startTransition(async () => {
      const r = await markAssignmentInProgress(assignmentId);
      if (!r.ok) setActionError(r.error);
    });
  }
  function runDeliver() {
    setActionError(null);
    startTransition(async () => {
      const r = await markAssignmentDelivered(assignmentId);
      if (!r.ok) setActionError(r.error);
    });
  }
  function runCancel() {
    setCancelError(null);
    startTransition(async () => {
      const r = await cancelAssignment(assignmentId, cancelReason || undefined);
      if (!r.ok) {
        setCancelError(r.error);
        return;
      }
      setCancelOpen(false);
      setCancelReason("");
    });
  }

  const isTerminal = isTerminalStatus(status);
  const showStart = canStart && (status === "scheduled" || status === "draft");
  // Mirror v1's reversible `finished_at` flag — show on both edges of the
  // delivered ↔ in_progress toggle. Label flips so the action is unambiguous.
  const showDeliver = canDeliver && status === "in_progress";
  const showUndeliver = canDeliver && status === "delivered";
  const showComplete = canComplete && status === "delivered";
  const showCancel = canCancel && !isTerminal;
  const showEdit = canUpdateFields && !isTerminal;

  return (
    <>
      {actionError && (
        <ErrorAlert className="mb-3">{tErr(actionError)}</ErrorAlert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {showEdit && (
          <Button
            href={`/dashboard/assignments/${assignmentId}/edit`}
            variant="secondary"
            size="sm"
          >
            {t("edit")}
          </Button>
        )}
        {showStart && (
          <Button size="sm" onClick={runStart} loading={pending}>
            <IconPlay size={12} />
            {t("startInspection")}
          </Button>
        )}
        {showDeliver && (
          <Button size="sm" onClick={runDeliver} loading={pending}>
            <IconCheck size={12} />
            {t("markDelivered")}
          </Button>
        )}
        {showUndeliver && (
          <Button
            size="sm"
            variant="ghost"
            onClick={runDeliver}
            loading={pending}
          >
            {t("markNotDelivered")}
          </Button>
        )}
        {showComplete && (
          <Button size="sm" onClick={() => setCompleteOpen(true)}>
            <IconCheck size={12} />
            {t("markCompleted")}
          </Button>
        )}
        {showCancel && (
          <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
            <IconX size={12} />
            {t("cancel")}
          </Button>
        )}
      </div>

      {cancelOpen && (
        <Modal
          overlay
          title={t("cancelDialogTitle")}
          description={t("cancelDialogDescription")}
          onClose={() => setCancelOpen(false)}
          className="w-full"
          footer={
              <>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setCancelOpen(false)}
                >
                  {t("cancelDialogKeepIt")}
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  onClick={runCancel}
                  loading={pending}
                >
                  <IconX size={12} />
                  {t("cancelDialogConfirm")}
                </Button>
              </>
            }
          >
          <div className="space-y-4">
            {cancelError && <ErrorAlert>{tErr(cancelError)}</ErrorAlert>}
            <Field
              label={t("cancelReasonLabel")}
              id="cancel-reason"
              hint={t("cancelReasonHint")}
            >
              <Textarea
                id="cancel-reason"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t("cancelReasonPlaceholder")}
              />
            </Field>
          </div>
        </Modal>
      )}

      <CompleteForm
        assignmentId={assignmentId}
        reference={reference}
        services={completeServices}
        defaultFinishedAt={defaultFinishedAt}
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
      />
    </>
  );
}
