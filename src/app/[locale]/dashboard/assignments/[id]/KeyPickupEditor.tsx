"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { setKeyPickup } from "@/app/actions/assignments";
import { useTranslateError } from "@/i18n/error";

type LocationType = "office" | "other";

type Props = {
  assignmentId: string;
  initial: {
    requiresKeyPickup: boolean;
    locationType: LocationType | null;
    address: string | null;
  };
  canEdit: boolean;
};

type KeyPickupT = (
  key:
    | "label"
    | "notRequired"
    | "required"
    | "addressPending"
    | "agencyOffice"
    | "checkboxLabel"
    | "atOffice"
    | "atOther"
    | "addressPlaceholder",
) => string;

function formatSummary(
  requires: boolean,
  locationType: LocationType | null,
  address: string | null,
  t: KeyPickupT,
): React.ReactNode {
  if (!requires) return t("notRequired");
  const suffix =
    locationType === "other"
      ? address?.trim() || t("addressPending")
      : t("agencyOffice");
  return (
    <>
      {t("required")}
      <span className="font-normal italic"> · {suffix}</span>
    </>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function KeyPickupEditor({ assignmentId, initial, canEdit }: Props) {
  const t = useTranslations("dashboard.assignments.keyPickup");
  const tShared = useTranslations("dashboard.assignments.shared");
  const tErr = useTranslateError();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [requires, setRequires] = useState(initial.requiresKeyPickup);
  const [locationType, setLocationType] = useState<LocationType>(
    initial.locationType ?? "office",
  );
  const [address, setAddress] = useState(initial.address ?? "");

  // Last-saved snapshot — Cancel restores form state without a server round-trip.
  const [saved, setSaved] = useState({
    requires: initial.requiresKeyPickup,
    locationType: initial.locationType ?? ("office" as LocationType),
    address: initial.address ?? "",
  });

  function openEditor() {
    setRequires(saved.requires);
    setLocationType(saved.locationType);
    setAddress(saved.address);
    setError(null);
    setOpen(true);
  }

  function cancel() {
    setOpen(false);
    setError(null);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) {
        setOpen(false);
        setError(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  function save() {
    setError(null);
    start(async () => {
      const res = await setKeyPickup(assignmentId, {
        requiresKeyPickup: requires,
        locationType: requires ? locationType : null,
        address: requires && locationType === "other" ? address.trim() : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved({
        requires,
        locationType,
        address: requires && locationType === "other" ? address.trim() : "",
      });
      setOpen(false);
    });
  }

  const summary = formatSummary(saved.requires, saved.locationType, saved.address, t);
  const fullAddress =
    saved.requires && saved.locationType === "other" && saved.address.trim()
      ? saved.address.trim()
      : null;

  // Required-with-address is the high-value state: dedicate the second line
  // to the full (wrapped) address so the inspector can read it without
  // hovering. Office / Not-required are quieter — same layout, lighter ink.
  const valueClass = saved.requires
    ? "mt-0.5 text-sm text-[var(--color-ink)]"
    : "mt-0.5 text-sm text-[var(--color-ink-soft)]";

  if (!canEdit) {
    return (
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
          {t("label")}
        </p>
        <p className={valueClass}>{summary}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openEditor}
        className="group block w-full rounded-md py-1 -my-1 -mx-2 px-2 text-left transition-colors hover:bg-[var(--color-bg-alt)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
              {t("label")}
            </p>
            <p className={valueClass}>{summary}</p>
          </div>
          <PencilIcon className="mt-0.5 shrink-0 text-[var(--color-ink-muted)] opacity-40 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3">
      <p className="font-medium text-[var(--color-ink)]">{t("label")}</p>

      <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
        <input
          type="checkbox"
          checked={requires}
          onChange={(e) => setRequires(e.target.checked)}
          disabled={pending}
          className="h-4 w-4 accent-[var(--color-brand)]"
        />
        {t("checkboxLabel")}
      </label>

      {requires && (
        <div className="ml-6 space-y-2">
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
            <input
              type="radio"
              name={`keyPickupLocationType-${assignmentId}`}
              checked={locationType === "office"}
              onChange={() => setLocationType("office")}
              disabled={pending}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            {t("atOffice")}
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
            <input
              type="radio"
              name={`keyPickupLocationType-${assignmentId}`}
              checked={locationType === "other"}
              onChange={() => setLocationType("other")}
              disabled={pending}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            {t("atOther")}
          </label>
          {locationType === "other" && (
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={pending}
              rows={3}
              placeholder={t("addressPlaceholder")}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-brand)] focus:outline-none disabled:opacity-60"
            />
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-[var(--color-asbestos)]">
          {tErr(error)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={cancel}
          disabled={pending}
        >
          {tShared("cancel")}
        </Button>
        <Button type="button" size="sm" onClick={save} loading={pending}>
          {tShared("save")}
        </Button>
      </div>
    </div>
  );
}
