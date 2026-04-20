"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { IconShield, IconPlus } from "@/components/ui/Icons";
import { transferTeamOwnership } from "@/app/actions/teams";

export type EligibleMember = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
};

export function TransferOwnershipButton({
  teamId,
  teamName,
  eligible,
}: {
  teamId: string;
  teamName: string;
  eligible: EligibleMember[];
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const res = await transferTeamOwnership(teamId, target);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <IconShield size={12} />
        Transfer ownership
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(15,23,42,0.5)] p-4 sm:p-8">
          <Modal
            title="Transfer team ownership"
            description={`Pick a new owner for ${teamName}. They'll get full edit + invite rights; you'll become a regular member.`}
            onClose={() => setOpen(false)}
            className="w-full"
            footer={
              <>
                <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="md"
                  onClick={handleConfirm}
                  loading={pending}
                  disabled={!target || eligible.length === 0}
                >
                  Confirm transfer
                </Button>
              </>
            }
          >
            {eligible.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-[var(--color-ink-soft)]">
                  You&apos;re the only eligible owner of this team. Invite another
                  realtor first — once they accept, you&apos;ll be able to transfer
                  ownership to them here.
                </p>
                <Link
                  href={`/dashboard/users/invite?teamId=${teamId}`}
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-[var(--color-on-brand)]"
                >
                  <IconPlus size={14} />
                  Invite a teammate
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {error && (
                  <p
                    role="alert"
                    className="rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-asbestos)]"
                  >
                    {error}
                  </p>
                )}
                <SearchSelect
                  label="New owner"
                  value={target}
                  onChange={setTarget}
                  placeholder="Pick an eligible teammate…"
                  searchPlaceholder="Type a name or email…"
                  options={eligible.map((m) => ({
                    value: m.userId,
                    label: `${m.firstName} ${m.lastName}`,
                    sublabel: m.email,
                  }))}
                />
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Only realtors and admins who are currently members of this team
                  appear here. Freelancer members cannot own the team.
                </p>
              </div>
            )}
          </Modal>
        </div>
      )}
    </>
  );
}
