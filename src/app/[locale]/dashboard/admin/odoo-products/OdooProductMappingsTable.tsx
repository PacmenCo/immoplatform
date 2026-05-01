"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { IconPlus, IconTrash } from "@/components/ui/Icons";
import {
  setOdooProductMapping,
  deleteOdooProductMapping,
} from "@/app/actions/odoo-product-mappings";
import { useTranslateError } from "@/i18n/error";

type Row = {
  id: string;
  teamId: string | null;
  teamName: string | null;
  serviceKey: string;
  propertyType: string;
  odooProductName: string;
  updatedAt: string;
};

type Props = {
  initialRows: Row[];
  teams: Array<{ id: string; name: string }>;
  services: Array<{ key: string; label: string; short: string }>;
};

const PROPERTY_TYPE_KEYS = [
  "house",
  "apartment",
  "studio",
  "studio_room",
  "commercial",
] as const;
type PropertyTypeKey = (typeof PROPERTY_TYPE_KEYS)[number];

export function OdooProductMappingsTable({
  initialRows,
  teams,
  services,
}: Props) {
  const t = useTranslations("dashboard.admin.odooProducts");
  const tTable = useTranslations("dashboard.admin.odooProducts.table");
  const tProp = useTranslations("dashboard.admin.odooProducts.propertyTypes");
  const tErr = useTranslateError();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    teamId: string;
    serviceKey: string;
    propertyType: string;
    odooProductName: string;
  }>({
    teamId: "",
    serviceKey: services[0]?.key ?? "asbestos",
    propertyType: "apartment",
    odooProductName: "",
  });

  function teamLabel(r: Row): string {
    return r.teamName ?? t("defaultTeam");
  }

  function serviceLabel(key: string): string {
    return services.find((s) => s.key === key)?.label ?? key;
  }

  function propertyLabel(value: string): string {
    if ((PROPERTY_TYPE_KEYS as readonly string[]).includes(value)) {
      return tProp(value as PropertyTypeKey);
    }
    return value;
  }

  function add() {
    setError(null);
    const teamId = draft.teamId === "" ? null : draft.teamId;
    const trimmed = draft.odooProductName.trim();
    if (!trimmed) {
      setError(t("productRequired"));
      return;
    }
    start(async () => {
      const res = await setOdooProductMapping({
        teamId,
        serviceKey: draft.serviceKey,
        propertyType: draft.propertyType,
        odooProductName: trimmed,
      });
      if (!res.ok) {
        setError(tErr(res.error));
        return;
      }
      // Optimistic local update — the server revalidates the page; the
      // refresh keeps timestamp / id correct on the next nav.
      const existing = rows.find(
        (r) =>
          r.teamId === teamId &&
          r.serviceKey === draft.serviceKey &&
          r.propertyType === draft.propertyType,
      );
      if (existing) {
        setRows(rows.map((r) =>
          r === existing ? { ...r, odooProductName: trimmed } : r,
        ));
      } else {
        const teamName = teamId
          ? (teams.find((tm) => tm.id === teamId)?.name ?? null)
          : null;
        setRows([
          ...rows,
          {
            id: `temp-${Date.now()}`,
            teamId,
            teamName,
            serviceKey: draft.serviceKey,
            propertyType: draft.propertyType,
            odooProductName: trimmed,
            updatedAt: new Date().toISOString(),
          },
        ]);
      }
      setDraft({ ...draft, odooProductName: "" });
    });
  }

  function remove(id: string) {
    setError(null);
    start(async () => {
      const res = await deleteOdooProductMapping({ id });
      if (!res.ok) {
        setError(tErr(res.error));
        return;
      }
      setRows(rows.filter((r) => r.id !== id));
    });
  }

  function updateProductName(id: string, name: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === row.odooProductName) return;
    setError(null);
    start(async () => {
      const res = await setOdooProductMapping({
        teamId: row.teamId,
        serviceKey: row.serviceKey,
        propertyType: row.propertyType,
        odooProductName: trimmed,
      });
      if (!res.ok) {
        setError(tErr(res.error));
        return;
      }
      setRows(rows.map((r) =>
        r.id === id ? { ...r, odooProductName: trimmed } : r,
      ));
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="mx-6 mt-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add-row form */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] px-6 py-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
          {t("addHeading")}
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <select
            value={draft.teamId}
            onChange={(e) => setDraft({ ...draft, teamId: e.target.value })}
            disabled={pending}
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
          >
            <option value="">{t("defaultTeam")}</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
          <select
            value={draft.serviceKey}
            onChange={(e) => setDraft({ ...draft, serviceKey: e.target.value })}
            disabled={pending}
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
          >
            {services.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={draft.propertyType}
            onChange={(e) =>
              setDraft({ ...draft, propertyType: e.target.value })
            }
            disabled={pending}
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
          >
            {PROPERTY_TYPE_KEYS.map((k) => (
              <option key={k} value={k}>
                {tProp(k)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={draft.odooProductName}
            onChange={(e) =>
              setDraft({ ...draft, odooProductName: e.target.value })
            }
            disabled={pending}
            placeholder={t("productPlaceholder")}
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm md:col-span-1"
          />
          <Button
            type="button"
            onClick={add}
            disabled={pending}
            size="sm"
          >
            <IconPlus size={14} />
            {t("addButton")}
          </Button>
        </div>
      </div>

      {/* Existing rows */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
            <tr>
              <th className="px-6 py-3 text-left font-medium">{tTable("team")}</th>
              <th className="px-6 py-3 text-left font-medium">{tTable("service")}</th>
              <th className="px-6 py-3 text-left font-medium">{tTable("propertyType")}</th>
              <th className="px-6 py-3 text-left font-medium">{tTable("productName")}</th>
              <th className="px-6 py-3 text-right font-medium">
                <span className="sr-only">{tTable("actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--color-ink-muted)]">
                  {tTable("empty")}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-3 text-[var(--color-ink-soft)]">
                    {teamLabel(r)}
                  </td>
                  <td className="px-6 py-3">{serviceLabel(r.serviceKey)}</td>
                  <td className="px-6 py-3">{propertyLabel(r.propertyType)}</td>
                  <td className="px-6 py-3">
                    <input
                      type="text"
                      defaultValue={r.odooProductName}
                      onBlur={(e) => updateProductName(r.id, e.target.value)}
                      disabled={pending}
                      className="w-full rounded border border-transparent bg-transparent px-2 py-1 hover:border-[var(--color-border)] focus:border-[var(--color-border-strong)] focus:bg-[var(--color-bg)] focus:outline-none"
                    />
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      disabled={pending}
                      title={tTable("delete")}
                      aria-label={tTable("delete")}
                      className="text-[var(--color-ink-muted)] hover:text-red-600 disabled:opacity-50"
                    >
                      <IconTrash size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
