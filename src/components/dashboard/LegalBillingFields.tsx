"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";

// UI-only: these inputs are not yet wired to the DB. The server action will
// silently ignore unknown form fields when this lands. Wire by adding the
// matching schema columns + reading them in the freelancer create action.

type EntityType = "sole_trader" | "company";

const VAT_RX = /^BE[0-9]{10}$/;
// Lenient BE IBAN check: BE + 14 digits (16 chars total). Format-only — full
// IBAN checksum can come with the schema.
const IBAN_RX = /^BE[0-9]{14}$/;

function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

export function LegalBillingFields({
  defaultEmail,
  defaultPhone,
}: {
  defaultEmail?: string;
  defaultPhone?: string;
}) {
  const [entityType, setEntityType] = useState<EntityType>("sole_trader");
  const [vat, setVat] = useState("");
  const [kbo, setKbo] = useState("");
  const [iban, setIban] = useState("");

  const vatNorm = vat.replace(/\s+|\./g, "").toUpperCase();
  const ibanNorm = iban.replace(/\s+/g, "").toUpperCase();
  const vatValid = vatNorm === "" || VAT_RX.test(vatNorm);
  const ibanValid = ibanNorm === "" || IBAN_RX.test(ibanNorm);

  // Auto-derive KBO from VAT (and vice versa) on blur. The user can still edit
  // either field afterwards.
  function syncFromVat(value: string) {
    const d = digitsOnly(value);
    if (d.length === 10 && !kbo) setKbo(d);
  }
  function syncFromKbo(value: string) {
    const d = digitsOnly(value);
    if (d.length === 10 && !vat) setVat(`BE${d}`);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Legal &amp; billing</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Used on issued invoices and the assignment form. Optional now,
              but needed before billing.
            </p>
          </div>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
            Optional
          </span>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {/* Type toggle. Drives whether "Legal name" is collected. */}
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">
            Business type
          </p>
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Business type"
          >
            <EntityOption
              value="sole_trader"
              label="Sole trader"
              description="Eenmanszaak — invoices issued under personal name."
              checked={entityType === "sole_trader"}
              onChange={setEntityType}
            />
            <EntityOption
              value="company"
              label="Company"
              description="BV / SRL or other legal entity."
              checked={entityType === "company"}
              onChange={setEntityType}
            />
          </div>
          <input type="hidden" name="entityType" value={entityType} />
        </div>

        {/* Legal name only when Company. Sole traders fall back to their
            personal first/last name from the profile section. */}
        {entityType === "company" && (
          <Field
            label="Legal name"
            id="legal-name"
            hint="As registered with the KBO/BCE."
          >
            <Input
              id="legal-name"
              name="legalName"
              placeholder="e.g. Acme Inspections BV"
              autoComplete="organization"
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="VAT number"
            id="vat-number"
            hint="Belgian format: BE + 10 digits"
            error={vat && !vatValid ? "Format should be BE + 10 digits." : undefined}
          >
            <Input
              id="vat-number"
              name="vatNumber"
              placeholder="BE 0712.345.678"
              value={vat}
              onChange={(e) => setVat(e.target.value)}
              onBlur={() => syncFromVat(vat)}
              autoComplete="off"
              inputMode="text"
            />
          </Field>
          <Field
            label="KBO / BCE number"
            id="kbo-number"
            hint="Same digits as VAT, without the BE prefix."
          >
            <Input
              id="kbo-number"
              name="kboNumber"
              placeholder="0712345678"
              value={kbo}
              onChange={(e) => setKbo(e.target.value)}
              onBlur={() => syncFromKbo(kbo)}
              autoComplete="off"
              inputMode="numeric"
            />
          </Field>
        </div>

        <Field
          label="IBAN"
          id="iban"
          hint="Belgian IBAN: BE + 14 digits."
          error={iban && !ibanValid ? "Format looks off — expected BE + 14 digits." : undefined}
        >
          <Input
            id="iban"
            name="iban"
            placeholder="BE68 5390 0754 7034"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            autoComplete="off"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Billing email"
            id="billing-email"
            hint="Where invoices and statements are sent."
          >
            <Input
              id="billing-email"
              name="billingEmail"
              type="email"
              placeholder={defaultEmail || "billing@agency.be"}
              defaultValue={defaultEmail || ""}
              autoComplete="email"
            />
          </Field>
          <Field label="Billing phone" id="billing-phone">
            <Input
              id="billing-phone"
              name="billingPhone"
              type="tel"
              placeholder={defaultPhone || "+32 3 234 56 78"}
              defaultValue={defaultPhone || ""}
              autoComplete="tel"
            />
          </Field>
        </div>

        <Field label="Billing address" id="billing-address">
          <Input
            id="billing-address"
            name="billingAddress"
            placeholder="Street + number"
            autoComplete="street-address"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Field label="Postal code" id="billing-postal">
            <Input
              id="billing-postal"
              name="billingPostal"
              placeholder="2000"
              autoComplete="postal-code"
              inputMode="numeric"
            />
          </Field>
          <Field label="City" id="billing-city">
            <Input
              id="billing-city"
              name="billingCity"
              placeholder="Antwerpen"
              autoComplete="address-level2"
            />
          </Field>
        </div>

        <Field label="Country" id="billing-country">
          <Input
            id="billing-country"
            name="billingCountry"
            defaultValue="Belgium"
            disabled
          />
        </Field>
      </CardBody>
    </Card>
  );
}

function EntityOption({
  value,
  label,
  description,
  checked,
  onChange,
}: {
  value: EntityType;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: EntityType) => void;
}) {
  return (
    <label
      className={
        "relative flex cursor-pointer items-start gap-3 rounded-md border bg-[var(--color-bg)] p-3 transition-all " +
        (checked
          ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/10 bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
          : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]")
      }
    >
      <input
        type="radio"
        name="entityType_visual"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={
          "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 " +
          (checked
            ? "border-[var(--color-brand)]"
            : "border-[var(--color-border-strong)]")
        }
      >
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-[var(--color-ink)]">
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--color-ink-soft)]">
          {description}
        </span>
      </span>
    </label>
  );
}
