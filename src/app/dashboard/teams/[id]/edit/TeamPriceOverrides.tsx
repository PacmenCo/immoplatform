"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { setTeamServiceOverride } from "@/app/actions/teams";
import { formatEuros } from "@/lib/pricing";

type ServiceRow = {
  key: string;
  label: string;
  short: string;
  color: string;
  basePriceCents: number;
  overrideCents: number | null;
};

export function TeamPriceOverrides({
  teamId,
  rows,
}: {
  teamId: string;
  rows: ServiceRow[];
}) {
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {rows.map((row) => (
        <ServiceOverrideRow key={row.key} teamId={teamId} row={row} />
      ))}
    </ul>
  );
}

function ServiceOverrideRow({
  teamId,
  row,
}: {
  teamId: string;
  row: ServiceRow;
}) {
  const [euros, setEuros] = useState<string>(
    row.overrideCents !== null
      ? (row.overrideCents / 100).toFixed(2).replace(/\.00$/, "")
      : "",
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    const raw = euros.trim();
    let cents: number | null = null;
    if (raw !== "") {
      const num = Number.parseFloat(raw.replace(",", "."));
      if (!Number.isFinite(num) || num < 0) {
        setError("Enter a positive number (e.g. 145 or 145.50).");
        return;
      }
      cents = Math.round(num * 100);
    }
    start(async () => {
      const res = await setTeamServiceOverride(teamId, row.key, cents);
      if (!res.ok) setError(res.error);
    });
  }

  function clear() {
    setEuros("");
    setError(null);
    start(async () => {
      const res = await setTeamServiceOverride(teamId, row.key, null);
      if (!res.ok) setError(res.error);
    });
  }

  const dirty =
    row.overrideCents === null
      ? euros.trim() !== ""
      : euros.trim() !==
        (row.overrideCents / 100).toFixed(2).replace(/\.00$/, "");

  return (
    <li className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-6 py-4">
      <span
        className="inline-flex h-6 items-center justify-center rounded px-1.5 text-[10px] font-bold tracking-wider text-white"
        style={{ backgroundColor: row.color }}
      >
        {row.short}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-ink)]">{row.label}</p>
        <p className="text-xs text-[var(--color-ink-muted)]">
          Base price {formatEuros(row.basePriceCents)}
        </p>
        {error && (
          <div className="mt-2">
            <ErrorAlert>{error}</ErrorAlert>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-sm text-[var(--color-ink-muted)]">€</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={euros}
          onChange={(e) => setEuros(e.target.value)}
          placeholder={(row.basePriceCents / 100).toFixed(2)}
          className="h-9 w-24 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 text-sm tabular-nums focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/15"
          aria-label={`Override price for ${row.label}`}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={save}
          loading={pending}
          disabled={!dirty}
        >
          Save
        </Button>
        {row.overrideCents !== null && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            loading={pending}
          >
            Reset
          </Button>
        )}
      </div>
    </li>
  );
}
