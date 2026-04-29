"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import {
  setTeamServiceOverride,
  setTeamServicePricelist,
} from "@/app/actions/teams";
import { formatEuros, formatPricelistItemPrice } from "@/lib/format";
import type { OdooPricelistItem } from "@/lib/odoo";

type ServiceRow = {
  key: string;
  label: string;
  short: string;
  color: string;
  basePriceCents: number;
  overrideCents: number | null;
  /** Currently bound Odoo pricelist id, if the row supports it. */
  odooPricelistId: number | null;
};

export type PricelistOption = { id: number; name: string };

export type PricelistItem = OdooPricelistItem;

/** Service keys that get an Odoo pricelist binding. Asbestos first; EK and
 *  EPC will be added once their Odoo product mappings are confirmed. */
const PRICELIST_ENABLED_SERVICES = new Set(["asbestos"]);

export function TeamPriceOverrides({
  teamId,
  rows,
  pricelists,
  pricelistItems,
}: {
  teamId: string;
  rows: ServiceRow[];
  pricelists?: PricelistOption[];
  pricelistItems?: PricelistItem[];
}) {
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {rows.map((row) => (
        <ServiceOverrideRow
          key={row.key}
          teamId={teamId}
          row={row}
          pricelists={pricelists}
          pricelistItems={pricelistItems}
        />
      ))}
    </ul>
  );
}

function ServiceOverrideRow({
  teamId,
  row,
  pricelists,
  pricelistItems,
}: {
  teamId: string;
  row: ServiceRow;
  pricelists?: PricelistOption[];
  pricelistItems?: PricelistItem[];
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

  useUnsavedChanges(dirty);

  const showsPricelist =
    PRICELIST_ENABLED_SERVICES.has(row.key) && pricelists !== undefined;

  // Pricelist-enabled services hide the manual override UI entirely — the
  // bound Odoo pricelist is the source of truth, an additional fixed-price
  // override would only confuse pricing resolution.
  if (showsPricelist) {
    return (
      <li className="px-6 py-4">
        <div className="flex items-center gap-4">
          <span
            className="inline-flex h-6 items-center justify-center rounded px-1.5 text-[10px] font-bold tracking-wider text-white"
            style={{ backgroundColor: row.color }}
          >
            {row.short}
          </span>
          <p className="text-sm font-medium text-[var(--color-ink)]">{row.label}</p>
        </div>
        <div className="mt-4 ml-9 border-l-2 border-[var(--color-border)] pl-4">
          <PricelistRow
            teamId={teamId}
            serviceKey={row.key}
            initial={row.odooPricelistId}
            pricelists={pricelists ?? []}
            pricelistItems={pricelistItems ?? []}
          />
        </div>
      </li>
    );
  }

  return (
    <li className="px-6 py-4">
      <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4">
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
            // type="text" + inputMode="decimal" so Belgian-locale users can
            // type "145,50" — native number inputs silently drop the comma.
            type="text"
            inputMode="decimal"
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
      </div>
    </li>
  );
}


function PricelistRow({
  teamId,
  serviceKey,
  initial,
  pricelists,
  pricelistItems,
}: {
  teamId: string;
  serviceKey: string;
  initial: number | null;
  pricelists: PricelistOption[];
  pricelistItems: PricelistItem[];
}) {
  const [selected, setSelected] = useState<string>(
    initial != null ? String(initial) : "",
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = selected !== (initial != null ? String(initial) : "");
  useUnsavedChanges(dirty);

  function save() {
    setError(null);
    const id = selected === "" ? null : Number.parseInt(selected, 10);
    start(async () => {
      const res = await setTeamServicePricelist(teamId, serviceKey, id);
      if (!res.ok) setError(res.error);
    });
  }

  const items = pricelistItems.filter(
    (it) => String(it.pricelistId) === selected,
  );

  const staleBinding =
    initial != null && !pricelists.some((p) => p.id === initial);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={`pricelist-${serviceKey}`}
          className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]"
        >
          Pricelist
        </label>
        <select
          id={`pricelist-${serviceKey}`}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-9 min-w-[16rem] rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 text-sm focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/15"
        >
          <option value="">— None —</option>
          {pricelists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          {staleBinding && (
            <option value={initial!}>
              #{initial} (missing in Odoo)
            </option>
          )}
        </select>
        <Button
          variant="secondary"
          size="sm"
          onClick={save}
          loading={pending}
          disabled={!dirty}
        >
          Save
        </Button>
        {pricelists.length === 0 && (
          <span className="text-xs text-[var(--color-ink-muted)]">
            No pricelists in Odoo (or Odoo is unreachable).
          </span>
        )}
      </div>
      {error && (
        <div className="mt-2">
          <ErrorAlert>{error}</ErrorAlert>
        </div>
      )}
      {selected !== "" && (
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
            Items in this pricelist
          </p>
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-3 text-center text-xs text-[var(--color-ink-muted)]">
              No items configured in Odoo for this pricelist.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-md border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--color-bg-alt)] text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Product</th>
                    <th className="px-3 py-2 text-right font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.id}
                      className="border-t border-[var(--color-border)]"
                    >
                      <td className="px-3 py-2 text-[var(--color-ink)]">
                        {it.productName}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatPricelistItemPrice(it)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
