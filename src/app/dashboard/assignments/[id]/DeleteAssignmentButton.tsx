"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { IconTrash } from "@/components/ui/Icons";
import { deleteAssignment } from "@/app/actions/assignments";

type Props = {
  assignmentId: string;
  reference: string;
};

export function DeleteAssignmentButton({ assignmentId, reference }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setOpen(false);
    setError(null);
    start(async () => {
      const res = await deleteAssignment(assignmentId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/dashboard/assignments");
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} loading={pending}>
        <IconTrash size={12} />
        Delete
      </Button>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <ConfirmDialog
        open={open}
        tone="danger"
        title={`Delete ${reference}?`}
        description="The assignment, its files, comments, and calendar events all go. Commission lines and invoices tied to it are removed as well. This can't be undone."
        confirmLabel="Delete assignment"
        cancelLabel="Keep it"
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
