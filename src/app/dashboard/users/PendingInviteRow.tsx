"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconMail } from "@/components/ui/Icons";
import { resendInvite, revokeInvite } from "@/app/actions/invites";

export function PendingInviteRow({
  inviteId,
  email,
  role,
  roleBadge,
  teamName,
  teamRole,
  invitedBy,
  sentAt,
}: {
  inviteId: string;
  email: string;
  role: string;
  roleBadge: { bg: string; fg: string };
  teamName: string | null;
  teamRole: string | null;
  invitedBy: string;
  sentAt: string;
}) {
  const [pending, startTransition] = useTransition();

  function doResend() {
    startTransition(async () => {
      await resendInvite(inviteId);
    });
  }

  function doRevoke() {
    if (!confirm(`Revoke invite for ${email}?`)) return;
    startTransition(async () => {
      await revokeInvite(inviteId);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-6 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]">
        <IconMail size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-ink)]">
          {email}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
          <Badge bg={roleBadge.bg} fg={roleBadge.fg} size="sm">
            <span className="capitalize">{role}</span>
          </Badge>
          {teamName && (
            <>
              <span>·</span>
              <span>
                {teamName} ({teamRole})
              </span>
            </>
          )}
          <span>·</span>
          <span>
            Sent by {invitedBy} on {sentAt}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={doResend} disabled={pending}>
          Resend
        </Button>
        <Button variant="ghost" size="sm" onClick={doRevoke} disabled={pending}>
          Revoke
        </Button>
      </div>
    </li>
  );
}
