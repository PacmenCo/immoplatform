"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { Modal } from "@/components/ui/Modal";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { IconPlus, IconUserSwap } from "@/components/ui/Icons";
import { reassignFreelancer } from "@/app/actions/assignments";

export type EligibleFreelancer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  region: string | null;
};

type Props = {
  assignmentId: string;
  currentFreelancerId: string | null;
  freelancers: EligibleFreelancer[];
  triggerLabel?: "assign" | "reassign";
};

export function ReassignFreelancerButton({
  assignmentId,
  currentFreelancerId,
  freelancers,
  triggerLabel = "reassign",
}: Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>(currentFreelancerId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A current freelancer may no longer be visible (deleted, or outside the
  // caller's tenancy after a scope change). Warn rather than silently clear.
  const currentOutOfScope =
    !!currentFreelancerId &&
    !freelancers.some((f) => f.id === currentFreelancerId);

  function runSave() {
    setError(null);
    startTransition(async () => {
      const res = await reassignFreelancer(assignmentId, target || null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      {triggerLabel === "assign" ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <IconPlus size={14} />
          Assign freelancer
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
        >
          <IconUserSwap size={12} />
          Change
        </button>
      )}

      {open && (
        <Modal
          overlay
          title={currentFreelancerId ? "Reassign freelancer" : "Assign a freelancer"}
          description="They'll see this assignment appear in their inspections list."
          onClose={() => setOpen(false)}
          className="w-full"
          footer={
            <>
              <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="md"
                onClick={runSave}
                loading={pending}
                disabled={target === (currentFreelancerId ?? "")}
              >
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {error && <ErrorAlert>{error}</ErrorAlert>}

            {currentOutOfScope && (
              <p className="rounded-md border border-[var(--color-electrical)]/30 bg-[color-mix(in_srgb,var(--color-electrical)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-ink-soft)]">
                The current freelancer is no longer in your team&apos;s
                roster. Saving will reassign to whoever you pick below.
              </p>
            )}

            {freelancers.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-soft)]">
                No freelancers are in your team&apos;s roster yet. Invite one
                from the Users page first.
              </p>
            ) : (
              <SearchSelect
                label="Freelancer"
                value={target}
                onChange={setTarget}
                placeholder="Pick a freelancer…"
                searchPlaceholder="Type a name or region…"
                clearOptionLabel="— Unassigned —"
                options={freelancers.map((f) => ({
                  value: f.id,
                  label: `${f.firstName} ${f.lastName}`,
                  sublabel: f.region ?? f.email,
                }))}
              />
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
