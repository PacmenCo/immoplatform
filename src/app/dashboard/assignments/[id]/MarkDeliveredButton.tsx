"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { markAssignmentDelivered } from "@/app/actions/assignments";

export function MarkDeliveredButton({
  assignmentId,
  disabled,
}: {
  assignmentId: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function go() {
    startTransition(async () => {
      const res = await markAssignmentDelivered(assignmentId);
      if (!res.ok) alert(res.error);
    });
  }

  return (
    <Button size="sm" onClick={go} disabled={disabled} loading={pending}>
      {disabled ? "Delivered" : "Mark as delivered"}
    </Button>
  );
}
