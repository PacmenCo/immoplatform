"use client";

import { ConfirmActionButton } from "@/components/ui/ConfirmActionButton";
import { IconTrash } from "@/components/ui/Icons";
import { deleteAssignment } from "@/app/actions/assignments";

export function DeleteAssignmentButton({
  assignmentId,
  reference,
}: {
  assignmentId: string;
  reference: string;
}) {
  return (
    <ConfirmActionButton
      action={() => deleteAssignment(assignmentId)}
      title={`Delete ${reference}?`}
      description="The assignment, its files, comments, and calendar events all go. Commission lines and invoices tied to it are removed as well. This can't be undone."
      confirmLabel="Delete assignment"
      cancelLabel="Keep it"
      triggerLabel={
        <>
          <IconTrash size={12} />
          Delete
        </>
      }
      redirectTo="/dashboard/assignments"
    />
  );
}
