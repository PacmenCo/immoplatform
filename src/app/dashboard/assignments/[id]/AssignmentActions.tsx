"use client";

import { useState, useTransition } from "react";
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
        <ErrorAlert className="mb-3">{actionError}</ErrorAlert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {showEdit && (
          <Button
            href={`/dashboard/assignments/${assignmentId}/edit`}
            variant="secondary"
            size="sm"
          >
            Edit
          </Button>
        )}
        {showStart && (
          <Button size="sm" onClick={runStart} loading={pending}>
            <IconPlay size={12} />
            Start inspection
          </Button>
        )}
        {showDeliver && (
          <Button size="sm" onClick={runDeliver} loading={pending}>
            <IconCheck size={12} />
            Mark delivered
          </Button>
        )}
        {showUndeliver && (
          <Button
            size="sm"
            variant="ghost"
            onClick={runDeliver}
            loading={pending}
          >
            Mark not delivered
          </Button>
        )}
        {showComplete && (
          <Button size="sm" onClick={() => setCompleteOpen(true)}>
            <IconCheck size={12} />
            Mark completed
          </Button>
        )}
        {showCancel && (
          <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
            <IconX size={12} />
            Cancel
          </Button>
        )}
      </div>

      {cancelOpen && (
        <Modal
          overlay
          title="Cancel this assignment?"
          description="Cancelled assignments can no longer be edited. This will be visible in the team's activity log."
          onClose={() => setCancelOpen(false)}
          className="w-full"
          footer={
              <>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setCancelOpen(false)}
                >
                  Keep it
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  onClick={runCancel}
                  loading={pending}
                >
                  <IconX size={12} />
                  Cancel assignment
                </Button>
              </>
            }
          >
          <div className="space-y-4">
            {cancelError && <ErrorAlert>{cancelError}</ErrorAlert>}
            <Field
              label="Reason (optional)"
              id="cancel-reason"
              hint="Posts as a comment on the assignment so the team has context."
            >
              <Textarea
                id="cancel-reason"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Owner changed their mind, duplicate order, etc."
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
