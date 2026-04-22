"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { IconTrash } from "@/components/ui/Icons";
import { deleteTeam } from "@/app/actions/teams";

type Props = {
  teamId: string;
  teamName: string;
};

export function DeleteTeamButton({ teamId, teamName }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setOpen(false);
    setError(null);
    start(async () => {
      const res = await deleteTeam(teamId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/dashboard/teams");
    });
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)} loading={pending}>
        <IconTrash size={14} />
        Delete team
      </Button>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <ConfirmDialog
        open={open}
        tone="danger"
        title={`Delete ${teamName}?`}
        description="Members, invites, service-price overrides, commission lines and payout history are all removed. Blocked when assignments still reference this team — delete or reassign those first."
        confirmLabel="Delete team"
        cancelLabel="Keep it"
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
