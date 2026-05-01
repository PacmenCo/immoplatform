"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("dashboard.shared.legalBillingFields");
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
            <CardTitle>{t("title")}</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {t("intro")}
            </p>
          </div>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
            {t("optionalBadge")}
          </span>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {/* Type toggle. Drives whether "Legal name" is collected. */}
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">
            {t("businessType")}
          </p>
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label={t("businessTypeAriaLabel")}
          >
            <EntityOption
              value="sole_trader"
              label={t("soleTrader")}
              description={t("soleTraderDescription")}
              checked={entityType === "sole_trader"}
              onChange={setEntityType}
            />
            <EntityOption
              value="company"
              label={t("company")}
              description={t("companyDescription")}
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
            label={t("legalName")}
            id="legal-name"
            hint={t("legalNameHint")}
          >
            <Input
              id="legal-name"
              name="legalName"
              placeholder={t("legalNamePlaceholder")}
              autoComplete="organization"
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("vatNumber")}
            id="vat-number"
            hint={t("vatHint")}
            error={vat && !vatValid ? t("vatError") : undefined}
          >
            <Input
              id="vat-number"
              name="vatNumber"
              placeholder={t("vatPlaceholder")}
              value={vat}
              onChange={(e) => setVat(e.target.value)}
              onBlur={() => syncFromVat(vat)}
              autoComplete="off"
              inputMode="text"
            />
          </Field>
          <Field
            label={t("kboNumber")}
            id="kbo-number"
            hint={t("kboHint")}
          >
            <Input
              id="kbo-number"
              name="kboNumber"
              placeholder={t("kboPlaceholder")}
              value={kbo}
              onChange={(e) => setKbo(e.target.value)}
              onBlur={() => syncFromKbo(kbo)}
              autoComplete="off"
              inputMode="numeric"
            />
          </Field>
        </div>

        <Field
          label={t("iban")}
          id="iban"
          hint={t("ibanHint")}
          error={iban && !ibanValid ? t("ibanError") : undefined}
        >
          <Input
            id="iban"
            name="iban"
            placeholder={t("ibanPlaceholder")}
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            autoComplete="off"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("billingEmail")}
            id="billing-email"
            hint={t("billingEmailHint")}
          >
            <Input
              id="billing-email"
              name="billingEmail"
              type="email"
              placeholder={defaultEmail || t("billingEmailPlaceholder")}
              defaultValue={defaultEmail || ""}
              autoComplete="email"
            />
          </Field>
          <Field label={t("billingPhone")} id="billing-phone">
            <Input
              id="billing-phone"
              name="billingPhone"
              type="tel"
              placeholder={defaultPhone || t("billingPhonePlaceholder")}
              defaultValue={defaultPhone || ""}
              autoComplete="tel"
            />
          </Field>
        </div>

        <Field label={t("billingAddress")} id="billing-address">
          <Input
            id="billing-address"
            name="billingAddress"
            placeholder={t("billingAddressPlaceholder")}
            autoComplete="street-address"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Field label={t("billingPostal")} id="billing-postal">
            <Input
              id="billing-postal"
              name="billingPostal"
              placeholder={t("billingPostalPlaceholder")}
              autoComplete="postal-code"
              inputMode="numeric"
            />
          </Field>
          <Field label={t("billingCity")} id="billing-city">
            <Input
              id="billing-city"
              name="billingCity"
              placeholder={t("billingCityPlaceholder")}
              autoComplete="address-level2"
            />
          </Field>
        </div>

        <Field label={t("country")} id="billing-country">
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
