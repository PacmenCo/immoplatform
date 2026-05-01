"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  canAct,
}: {
  inviteId: string;
  email: string;
  role: string;
  roleBadge: { bg: string; fg: string };
  teamName: string | null;
  teamRole: string | null;
  invitedBy: string;
  sentAt: string;
  canAct: boolean;
}) {
  const t = useTranslations("dashboard.users.pendingInvites.row");
  const tRoles = useTranslations("dashboard.users.roles");
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function doResend() {
    startTransition(async () => {
      await resendInvite(inviteId);
    });
  }

  function runRevoke() {
    setConfirmOpen(false);
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
            <span>{tRoles(role as "admin" | "staff" | "realtor" | "freelancer")}</span>
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
            {t("metaSentBy", { name: invitedBy, date: sentAt })}
          </span>
        </div>
      </div>
      {canAct && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={doResend} disabled={pending}>
            {t("resend")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={pending}
          >
            {t("revoke")}
          </Button>
        </div>
      )}
      {canAct && (
        <ConfirmDialog
          open={confirmOpen}
          tone="danger"
          title={t("confirmTitle", { email })}
          description={t("confirmDescription")}
          confirmLabel={t("confirmLabel")}
          cancelLabel={t("cancelLabel")}
          onConfirm={runRevoke}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </li>
  );
}
