"use client";

import { ConfirmActionButton } from "@/components/ui/ConfirmActionButton";
import { deleteUserByAdmin } from "@/app/actions/users";

type Props = {
  userId: string;
  userName: string;
  redirectTo?: string;
  size?: "sm" | "md";
};

export function DeleteUserButton({ userId, userName, redirectTo, size = "sm" }: Props) {
  return (
    <ConfirmActionButton
      action={() => deleteUserByAdmin(userId)}
      title={`Delete ${userName}?`}
      description="The account is soft-deleted — they can no longer sign in and every active session is revoked. Assignments and comments they created stay in place, attributed to their name."
      confirmLabel="Delete user"
      cancelLabel="Keep"
      triggerLabel="Delete"
      triggerSize={size}
      redirectTo={redirectTo}
    />
  );
}
