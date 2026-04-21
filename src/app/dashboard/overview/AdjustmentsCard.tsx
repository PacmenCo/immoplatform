"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { IconPlus, IconTrash } from "@/components/ui/Icons";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { formatEuros } from "@/lib/format";
import { MONTH_LONG, MONTH_SHORT } from "@/lib/period";
import {
  createRevenueAdjustment,
  deleteRevenueAdjustment,
} from "@/app/actions/revenueAdjustments";

type Adjustment = {
  id: string;
  teamId: string;
  teamName: string;
  year: number;
  month: number;
  description: string;
  amountCents: number;
  createdAt: Date;
  createdByName: string | null;
};

type Team = { id: string; name: string };

type Props = {
  adjustments: Adjustment[];
  teams: Team[];
  /** Default year/month the add form lands on — tied to the focus period. */
  defaultYear: number;
  defaultMonth: number;
  periodLabel: string;
};

export function AdjustmentsCard({
  adjustments,
  teams,
  defaultYear,
  defaultMonth,
  periodLabel,
}: Props) {
  // Separate transition per action so a delete's spinner doesn't appear on
  // the Save button (or vice versa) if the user clicks both in quick succession.
  const [formPending, startForm] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  // Dirty whenever the add form is open AND the user has typed something.
  useUnsavedChanges(formOpen && (description.length > 0 || amount.length > 0));

  function reset() {
    setTeamId(teams[0]?.id ?? "");
    setYear(defaultYear);
    setMonth(defaultMonth);
    setDescription("");
    setAmount("");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startForm(async () => {
      const res = await createRevenueAdjustment({
        teamId,
        year,
        month,
        description,
        amountEuros: amount,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      reset();
      setFormOpen(false);
    });
  }

  function remove(id: string) {
    setDeletingId(id);
    setError(null);
    startDelete(async () => {
      const res = await deleteRevenueAdjustment(id);
      if (!res.ok) setError(res.error);
      setDeletingId(null);
    });
  }

  const total = adjustments.reduce((s, a) => s + a.amountCents, 0);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <div>
          <CardTitle>Manual adjustments</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Journal corrections, bonuses, and deductions for {periodLabel}. Negative amounts subtract from booked revenue.
          </p>
        </div>
        {!formOpen && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <IconPlus size={14} />
            Add adjustment
          </Button>
        )}
      </CardHeader>

      {formOpen && (
        <CardBody className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1.2fr_1fr_1fr_2fr_1fr_auto]">
            <Field label="Team" id="adj-team">
              <Select
                id="adj-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                required
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Year" id="adj-year">
              <Input
                id="adj-year"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number.parseInt(e.target.value, 10) || defaultYear)}
              />
            </Field>
            <Field label="Month" id="adj-month">
              <Select
                id="adj-month"
                value={month}
                onChange={(e) => setMonth(Number.parseInt(e.target.value, 10))}
              >
                {MONTH_LONG.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Description" id="adj-desc">
              <Input
                id="adj-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Late invoice settled in March"
                maxLength={500}
                required
              />
            </Field>
            <Field label="Amount (€)" id="adj-amount" hint="Use a negative number for deductions">
              <Input
                id="adj-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 150 or -50.00"
                required
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm" loading={formPending}>
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  reset();
                  setFormOpen(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
          {error && <div className="mt-3"><ErrorAlert>{error}</ErrorAlert></div>}
        </CardBody>
      )}

      <CardBody className="p-0">
        {adjustments.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-[var(--color-ink-muted)]">
            No adjustments for {periodLabel}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <th className="px-6 py-3 text-left font-semibold">Team</th>
                  <th className="px-6 py-3 text-left font-semibold">Month</th>
                  <th className="px-6 py-3 text-left font-semibold">Description</th>
                  <th className="px-6 py-3 text-right font-semibold">Amount</th>
                  <th className="px-6 py-3 text-left font-semibold">Added by</th>
                  <th className="px-6 py-3 text-right font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {adjustments.map((a) => {
                  const negative = a.amountCents < 0;
                  return (
                    <tr key={a.id} className="hover:bg-[var(--color-bg-alt)]">
                      <td className="px-6 py-3 font-medium text-[var(--color-ink)]">{a.teamName}</td>
                      <td className="px-6 py-3 text-[var(--color-ink-soft)] tabular-nums">
                        {MONTH_SHORT[a.month - 1]} {a.year}
                      </td>
                      <td className="px-6 py-3 text-[var(--color-ink-soft)]">{a.description}</td>
                      <td
                        className={
                          "px-6 py-3 text-right font-medium tabular-nums " +
                          (negative ? "text-[var(--color-asbestos)]" : "text-[var(--color-ink)]")
                        }
                      >
                        {formatEuros(a.amountCents)}
                      </td>
                      <td className="px-6 py-3 text-xs text-[var(--color-ink-muted)]">
                        {a.createdByName ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={deletePending && deletingId === a.id}
                          onClick={() => remove(a.id)}
                        >
                          <IconTrash size={14} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--color-border)] bg-[var(--color-bg-alt)]">
                  <td className="px-6 py-3 text-xs uppercase tracking-wider text-[var(--color-ink-muted)]" colSpan={3}>
                    Total
                  </td>
                  <td
                    className={
                      "px-6 py-3 text-right font-semibold tabular-nums " +
                      (total < 0 ? "text-[var(--color-asbestos)]" : "text-[var(--color-ink)]")
                    }
                  >
                    {formatEuros(total)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
