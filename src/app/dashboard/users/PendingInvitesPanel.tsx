"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/Icons";
import { PendingInviteRow } from "./PendingInviteRow";

export type PendingInviteData = {
  id: string;
  email: string;
  role: string;
  roleBadge: { bg: string; fg: string };
  teamName: string | null;
  teamRole: string | null;
  invitedBy: string;
  sentAt: string;
};

const PER_PAGE = 5;

export function PendingInvitesPanel({
  invites,
  canInvite,
}: {
  invites: PendingInviteData[];
  canInvite: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);

  const total = invites.length;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PER_PAGE;
  const visible = invites.slice(start, start + PER_PAGE);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3 p-0">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="pending-invites-list"
          className="flex flex-1 items-center gap-3 p-6 text-left transition-colors hover:bg-[var(--color-bg-alt)] rounded-l-[var(--radius-lg)]"
        >
          <div className="flex-1">
            <CardTitle>Pending invites</CardTitle>
            <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
              {total} invite{total === 1 ? "" : "s"} awaiting acceptance
            </p>
          </div>
          <ChevronIcon expanded={expanded} />
        </button>
        {canInvite && (
          <div className="pr-6">
            <Button href="/dashboard/users/invite" variant="secondary" size="sm">
              <IconPlus size={14} />
              Invite user
            </Button>
          </div>
        )}
      </CardHeader>
      {expanded && (
        <div id="pending-invites-list">
          <ul className="divide-y divide-[var(--color-border)]">
            {visible.map((inv) => (
              <PendingInviteRow
                key={inv.id}
                inviteId={inv.id}
                email={inv.email}
                role={inv.role}
                roleBadge={inv.roleBadge}
                teamName={inv.teamName}
                teamRole={inv.teamRole}
                invitedBy={inv.invitedBy}
                sentAt={inv.sentAt}
                canAct={canInvite}
              />
            ))}
          </ul>
          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-6 py-3 text-xs text-[var(--color-ink-muted)]">
              <span className="tabular-nums">
                Showing {start + 1}–{Math.min(start + PER_PAGE, total)} of {total}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  Previous
                </Button>
                <span className="px-2 tabular-nums">
                  {safePage} / {pageCount}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={safePage === pageCount}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={
        "shrink-0 text-[var(--color-ink-muted)] transition-transform " +
        (expanded ? "rotate-180" : "")
      }
    >
      <polyline points="4 6 8 10 12 6" />
    </svg>
  );
}
