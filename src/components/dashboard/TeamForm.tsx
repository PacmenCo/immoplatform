"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import type { ActionResult } from "@/app/actions/_types";

export type TeamFormInitial = {
  name: string;
  city: string | null;
  email: string | null;
  description: string | null;
  logo: string | null;
  logoColor: string | null;
  legalName: string | null;
  vatNumber: string | null;
  kboNumber: string | null;
  iban: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  billingAddress: string | null;
  billingPostal: string | null;
  billingCity: string | null;
  billingCountry: string | null;
  defaultClientType: string | null;
  prefersLogoOnPhotos: boolean;
  commissionType: string | null;
  commissionValue: number | null;
};

type Props = {
  action: (
    prev: ActionResult | undefined,
    formData: FormData,
  ) => Promise<ActionResult>;
  initial?: TeamFormInitial;
  submitLabel?: string;
  cancelHref: string;
  /** v1 parity: commission config is admin-only; realtor-owners shouldn't
   * even see the inputs on the edit page. Defaults to false for safety. */
  isAdmin?: boolean;
};

/** Preview swatch next to the color picker so users see what they're choosing. */
function LogoPreview({ logo, color }: { logo: string; color: string }) {
  return (
    <span
      aria-hidden
      className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-sm font-bold text-white"
      style={{ backgroundColor: color || "#0f172a" }}
    >
      {(logo || "??").slice(0, 3).toUpperCase()}
    </span>
  );
}

export function TeamForm({ action, initial, submitLabel, cancelHref, isAdmin = false }: Props) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  // Controlled for the logo preview only — everything else stays uncontrolled.
  const [logo, setLogo] = useState(initial?.logo ?? "");
  const [logoColor, setLogoColor] = useState(initial?.logoColor ?? "#0f172a");

  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedChanges(useFormDirty(formRef));

  const submit = submitLabel ?? (initial ? "Save changes" : "Create team");

  return (
    <form ref={formRef} action={formAction} className="max-w-[960px] p-8 pb-28 space-y-6">
      {state && !state.ok && <ErrorAlert>{state.error}</ErrorAlert>}

      <Card>
        <CardHeader>
          <CardTitle>Team basics</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Name, location, and the badge shown on cards across the dashboard.
          </p>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-6">
          <div className="sm:col-span-4">
            <Field label="Team name" id="name" required>
              <Input
                id="name"
                name="name"
                placeholder="Vastgoed Antwerp"
                defaultValue={initial?.name ?? ""}
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="City" id="city">
              <Input
                id="city"
                name="city"
                placeholder="Antwerpen"
                defaultValue={initial?.city ?? ""}
              />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Team email" id="email" hint="Shared inbox — used on invoices.">
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="contact@agency.be"
                defaultValue={initial?.email ?? ""}
              />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Short description" id="description">
              <Input
                id="description"
                name="description"
                placeholder="e.g. Residential specialists in Flanders"
                defaultValue={initial?.description ?? ""}
              />
            </Field>
          </div>
          <div className="sm:col-span-6">
            <Field label="Badge" id="logo" hint="1–3 letters shown on team cards until a logo image is uploaded.">
              <div className="flex items-center gap-4">
                <LogoPreview logo={logo} color={logoColor} />
                <Input
                  id="logo"
                  name="logo"
                  className="max-w-[100px]"
                  maxLength={3}
                  placeholder="VA"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  required
                />
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
                  Color
                  <input
                    type="color"
                    name="logoColor"
                    className="h-9 w-14 cursor-pointer rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                    value={logoColor}
                    onChange={(e) => setLogoColor(e.target.value)}
                  />
                </label>
              </div>
            </Field>
          </div>
        </CardBody>
      </Card>

      <details
        className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]"
        open={!!initial?.legalName}
      >
        <summary className="flex cursor-pointer items-center justify-between p-6 [&::-webkit-details-marker]:hidden">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-ink)]">Legal + billing</h3>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Used on issued invoices and the opdrachtformulier. Optional now, but needed before billing.
            </p>
          </div>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-ink-muted)] transition-transform group-open:rotate-45">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </summary>
        <div className="grid gap-5 border-t border-[var(--color-border)] p-6 sm:grid-cols-2">
          <Field label="Legal name" id="legalName">
            <Input id="legalName" name="legalName" placeholder="Vastgoed Antwerp BV" defaultValue={initial?.legalName ?? ""} />
          </Field>
          <Field label="VAT number" id="vatNumber">
            <Input id="vatNumber" name="vatNumber" placeholder="BE 0712.345.678" defaultValue={initial?.vatNumber ?? ""} />
          </Field>
          <Field label="Chamber of Commerce (KBO)" id="kboNumber">
            <Input id="kboNumber" name="kboNumber" placeholder="0712345678" defaultValue={initial?.kboNumber ?? ""} />
          </Field>
          <Field label="IBAN" id="iban">
            <Input id="iban" name="iban" placeholder="BE68 5390 0754 7034" defaultValue={initial?.iban ?? ""} />
          </Field>
          <Field label="Billing email" id="billingEmail">
            <Input id="billingEmail" name="billingEmail" type="email" placeholder="billing@agency.be" defaultValue={initial?.billingEmail ?? ""} />
          </Field>
          <Field label="Billing phone" id="billingPhone">
            <Input id="billingPhone" name="billingPhone" placeholder="+32 3 234 56 78" defaultValue={initial?.billingPhone ?? ""} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Billing address" id="billingAddress">
              <Textarea
                id="billingAddress"
                name="billingAddress"
                rows={2}
                placeholder="Street + number"
                defaultValue={initial?.billingAddress ?? ""}
              />
            </Field>
          </div>
          <Field label="Postal code" id="billingPostal">
            <Input id="billingPostal" name="billingPostal" placeholder="2000" defaultValue={initial?.billingPostal ?? ""} />
          </Field>
          <Field label="Billing city" id="billingCity">
            <Input id="billingCity" name="billingCity" placeholder="Antwerpen" defaultValue={initial?.billingCity ?? ""} />
          </Field>
          <Field label="Country" id="billingCountry">
            <Input id="billingCountry" name="billingCountry" placeholder="Belgium" defaultValue={initial?.billingCountry ?? "Belgium"} />
          </Field>
          <Field
            label="Invoice recipient default"
            id="defaultClientType"
            hint="Drives which contact block prints on invoices. Overridable per assignment."
          >
            <Select
              id="defaultClientType"
              name="defaultClientType"
              defaultValue={initial?.defaultClientType ?? ""}
            >
              <option value="">No default</option>
              <option value="owner">Particulier (owner)</option>
              <option value="firm">Firm (bedrijf)</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Switch
              id="prefersLogoOnPhotos"
              name="prefersLogoOnPhotos"
              label="Stamp team logo on property photos"
              description="When on, the team's branding is overlaid on listing photos generated by the platform."
              defaultChecked={initial?.prefersLogoOnPhotos ?? false}
            />
          </div>
        </div>
      </details>

      {isAdmin && (
        <details
          className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]"
          open={!!initial?.commissionType}
        >
          <summary className="flex cursor-pointer items-center justify-between p-6 [&::-webkit-details-marker]:hidden">
            <div>
              <h3 className="text-base font-semibold text-[var(--color-ink)]">Commission</h3>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                How much the team keeps per delivered assignment. Set once, applies platform-wide.
              </p>
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-ink-muted)] transition-transform group-open:rotate-45">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </summary>
          <div className="grid gap-5 border-t border-[var(--color-border)] p-6 sm:grid-cols-2">
            <Field label="Model" id="commissionType">
              <Select
                id="commissionType"
                name="commissionType"
                defaultValue={initial?.commissionType ?? "none"}
              >
                <option value="none">No commission</option>
                <option value="percentage">Percentage of order</option>
                <option value="fixed">Fixed amount per order</option>
              </Select>
            </Field>
            <Field
              label="Value"
              id="commissionValue"
              hint="Percentage: basis points (1500 = 15%). Fixed: cents (2500 = €25.00)."
            >
              <Input
                id="commissionValue"
                name="commissionValue"
                type="number"
                min={0}
                placeholder="1500"
                defaultValue={initial?.commissionValue ?? ""}
              />
            </Field>
          </div>
        </details>
      )}

      <div className="sticky bottom-0 z-30 -mx-8 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-8 py-4">
          <p className="text-xs text-[var(--color-ink-muted)]">
            <span aria-hidden className="text-[var(--color-asbestos)]">*</span> Required
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" href={cancelHref}>
              Cancel
            </Button>
            <Button type="submit" size="md" loading={pending}>
              {submit}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
