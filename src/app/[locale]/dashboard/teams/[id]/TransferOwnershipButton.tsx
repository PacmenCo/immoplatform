"use client";

import { Link } from "@/i18n/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { IconShield, IconPlus } from "@/components/ui/Icons";
import { transferTeamOwnership } from "@/app/actions/teams";
import { useTranslateError } from "@/i18n/error";

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
  const t = useTranslations("dashboard.teams.detail.transferOwnership");
  const tErr = useTranslateError();
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
        {t("trigger")}
      </Button>

      {open && (
        <Modal
          overlay
          title={t("modalTitle")}
          description={t("modalDescription", { team: teamName })}
          onClose={() => setOpen(false)}
          className="w-full"
          footer={
            <>
              <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button
                size="md"
                onClick={handleConfirm}
                loading={pending}
                disabled={!target || eligible.length === 0}
              >
                {t("confirm")}
              </Button>
            </>
          }
        >
          {eligible.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-ink-soft)]">
                {t("noEligible")}
              </p>
              <Link
                href={`/dashboard/users/invite?teamId=${teamId}`}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-[var(--color-on-brand)]"
              >
                <IconPlus size={14} />
                {t("inviteTeammate")}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-asbestos)]"
                >
                  {tErr(error)}
                </p>
              )}
              <SearchSelect
                label={t("newOwnerLabel")}
                value={target}
                onChange={setTarget}
                placeholder={t("newOwnerPlaceholder")}
                searchPlaceholder={t("newOwnerSearchPlaceholder")}
                options={eligible.map((m) => ({
                  value: m.userId,
                  label: `${m.firstName} ${m.lastName}`,
                  sublabel: m.email,
                }))}
              />
              <p className="text-xs text-[var(--color-ink-muted)]">
                {t("eligibleHint")}
              </p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
