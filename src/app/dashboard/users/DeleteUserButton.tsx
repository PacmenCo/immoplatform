"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { deleteUserByAdmin } from "@/app/actions/users";

type Props = {
  userId: string;
  userName: string;
  /** Where to navigate after a successful delete. List page, typically. */
  redirectTo?: string;
  size?: "sm" | "md";
};

export function DeleteUserButton({ userId, userName, redirectTo, size = "sm" }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setOpen(false);
    setError(null);
    start(async () => {
      const res = await deleteUserByAdmin(userId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size={size} onClick={() => setOpen(true)} loading={pending}>
        Delete
      </Button>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <ConfirmDialog
        open={open}
        tone="danger"
        title={`Delete ${userName}?`}
        description="The account is soft-deleted — they can no longer sign in and every active session is revoked. Assignments and comments they created stay in place, attributed to their name."
        confirmLabel="Delete user"
        cancelLabel="Keep"
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
