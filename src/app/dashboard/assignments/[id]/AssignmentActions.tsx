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

type Props = {
  assignmentId: string;
  status: string;
  canTransition: boolean;
  canUpdateFields: boolean;
  canComplete: boolean;
  canCancel: boolean;
};

export function AssignmentActions({
  assignmentId,
  status,
  canTransition,
  canUpdateFields,
  canComplete,
  canCancel,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Guard the typed cancellation reason — losing it would force the user
  // to write it again. Only active while the modal is open.
  useUnsavedChanges(cancelOpen && cancelReason.trim().length > 0);

  function runStart() {
    startTransition(async () => {
      const r = await markAssignmentInProgress(assignmentId);
      if (!r.ok) alert(r.error);
    });
  }
  function runDeliver() {
    startTransition(async () => {
      const r = await markAssignmentDelivered(assignmentId);
      if (!r.ok) alert(r.error);
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
  const showStart =
    canTransition && (status === "scheduled" || status === "draft");
  const showDeliver = canTransition && status === "in_progress";
  const showComplete = canComplete && status === "delivered";
  const showCancel = canCancel && !isTerminal;
  const showEdit = canUpdateFields && !isTerminal;

  return (
    <>
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
        {showComplete && (
          <Button
            href={`/dashboard/assignments/${assignmentId}/complete`}
            size="sm"
          >
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(15,23,42,0.5)] p-4 sm:p-8">
          <Modal
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
        </div>
      )}
    </>
  );
}
