"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { removeTeamMember } from "@/app/actions/teams";

type Props = {
  teamId: string;
  userId: string;
  memberName: string;
  teamName: string;
};

export function RemoveMemberButton({ teamId, userId, memberName, teamName }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setOpen(false);
    setError(null);
    start(async () => {
      const res = await removeTeamMember(teamId, userId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} loading={pending}>
        Remove
      </Button>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <ConfirmDialog
        open={open}
        tone="danger"
        title={`Remove ${memberName} from ${teamName}?`}
        description="They lose access to this team's assignments immediately. Their account and any assignments they personally created stay put."
        confirmLabel="Remove member"
        cancelLabel="Keep"
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
