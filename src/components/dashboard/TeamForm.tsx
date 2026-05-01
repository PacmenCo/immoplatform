"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
import { useTranslateError } from "@/i18n/error";
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

export function TeamForm({
  action,
  initial,
  submitLabel,
  cancelHref,
  isAdmin = false,
}: Props) {
  const t = useTranslations("dashboard.shared.teamForm");
  const tCommon = useTranslations("dashboard.shared.common");
  const tErr = useTranslateError();
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  // Controlled for the logo preview only — everything else stays uncontrolled.
  const [logo, setLogo] = useState(initial?.logo ?? "");
  const [logoColor, setLogoColor] = useState(initial?.logoColor ?? "#0f172a");

  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedChanges(useFormDirty(formRef));

  const submit = submitLabel ?? (initial ? t("submitEdit") : t("submitCreate"));

  return (
    <form ref={formRef} action={formAction} className="max-w-[960px] p-8 pb-28 space-y-6">
      {state && !state.ok && <ErrorAlert>{tErr(state.error)}</ErrorAlert>}

      <Card>
        <CardHeader>
          <CardTitle>{t("basicsTitle")}</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {t("basicsDescription")}
          </p>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-6">
          <div className="sm:col-span-4">
            <Field label={t("name")} id="name" required>
              <Input
                id="name"
                name="name"
                placeholder={t("namePlaceholder")}
                defaultValue={initial?.name ?? ""}
                autoComplete="off"
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t("city")} id="city">
              <Input
                id="city"
                name="city"
                placeholder={t("cityPlaceholder")}
                defaultValue={initial?.city ?? ""}
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label={t("email")} id="email" hint={t("emailHint")}>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                defaultValue={initial?.email ?? ""}
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label={t("shortDescription")} id="description">
              <Input
                id="description"
                name="description"
                placeholder={t("shortDescriptionPlaceholder")}
                defaultValue={initial?.description ?? ""}
              />
            </Field>
          </div>
          <div className="sm:col-span-6">
            <Field label={t("badge")} id="logo" hint={t("badgeHint")}>
              <div className="flex items-center gap-4">
                <LogoPreview logo={logo} color={logoColor} />
                <Input
                  id="logo"
                  name="logo"
                  className="max-w-[100px]"
                  maxLength={3}
                  placeholder={t("badgePlaceholder")}
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
                  {t("color")}
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
          <div className="sm:col-span-6">
            <Switch
              id="prefersLogoOnPhotos"
              name="prefersLogoOnPhotos"
              label={t("stampLogo")}
              description={t("stampLogoDescription")}
              defaultChecked={initial?.prefersLogoOnPhotos ?? false}
            />
          </div>
        </CardBody>
      </Card>

      <details
        className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]"
        open={!!initial?.legalName}
      >
        <summary className="flex cursor-pointer items-center justify-between p-6 [&::-webkit-details-marker]:hidden">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-ink)]">{t("legalTitle")}</h3>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {t("legalDescription")}
            </p>
          </div>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-ink-muted)] transition-transform group-open:rotate-45">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </summary>
        <div className="grid gap-5 border-t border-[var(--color-border)] p-6 sm:grid-cols-2">
          <Field label={t("legalName")} id="legalName">
            <Input id="legalName" name="legalName" placeholder={t("legalNamePlaceholder")} defaultValue={initial?.legalName ?? ""} autoComplete="off" />
          </Field>
          <Field label={t("vatNumber")} id="vatNumber">
            <Input id="vatNumber" name="vatNumber" placeholder={t("vatPlaceholder")} defaultValue={initial?.vatNumber ?? ""} autoComplete="off" />
          </Field>
          <Field label={t("kboNumber")} id="kboNumber">
            <Input id="kboNumber" name="kboNumber" placeholder={t("kboPlaceholder")} defaultValue={initial?.kboNumber ?? ""} autoComplete="off" />
          </Field>
          <Field label={t("iban")} id="iban">
            <Input id="iban" name="iban" placeholder={t("ibanPlaceholder")} defaultValue={initial?.iban ?? ""} autoComplete="off" />
          </Field>
          <Field label={t("billingEmail")} id="billingEmail">
            <Input id="billingEmail" name="billingEmail" type="email" placeholder={t("billingEmailPlaceholder")} defaultValue={initial?.billingEmail ?? ""} autoComplete="off" />
          </Field>
          <Field label={t("billingPhone")} id="billingPhone">
            <Input id="billingPhone" name="billingPhone" placeholder={t("billingPhonePlaceholder")} defaultValue={initial?.billingPhone ?? ""} autoComplete="off" />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("billingAddress")} id="billingAddress">
              <Textarea
                id="billingAddress"
                name="billingAddress"
                rows={2}
                placeholder={t("billingAddressPlaceholder")}
                defaultValue={initial?.billingAddress ?? ""}
                autoComplete="off"
              />
            </Field>
          </div>
          <Field label={t("billingPostal")} id="billingPostal">
            <Input id="billingPostal" name="billingPostal" placeholder={t("billingPostalPlaceholder")} defaultValue={initial?.billingPostal ?? ""} autoComplete="off" />
          </Field>
          <Field label={t("billingCity")} id="billingCity">
            <Input id="billingCity" name="billingCity" placeholder={t("billingCityPlaceholder")} defaultValue={initial?.billingCity ?? ""} autoComplete="off" />
          </Field>
          <Field label={t("country")} id="billingCountry">
            <Input id="billingCountry" name="billingCountry" placeholder={t("countryPlaceholder")} defaultValue={initial?.billingCountry ?? "Belgium"} autoComplete="off" />
          </Field>
          <Field
            label={t("invoiceRecipient")}
            id="defaultClientType"
            hint={t("invoiceRecipientHint")}
          >
            <Select
              id="defaultClientType"
              name="defaultClientType"
              defaultValue={initial?.defaultClientType ?? ""}
            >
              <option value="">{t("noDefault")}</option>
              <option value="owner">{t("particulier")}</option>
              <option value="firm">{t("firm")}</option>
            </Select>
          </Field>
        </div>
      </details>

      {isAdmin && (
        <details
          className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]"
          open={!!initial?.commissionType}
        >
          <summary className="flex cursor-pointer items-center justify-between p-6 [&::-webkit-details-marker]:hidden">
            <div>
              <h3 className="text-base font-semibold text-[var(--color-ink)]">{t("commissionTitle")}</h3>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                {t("commissionDescription")}
              </p>
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-ink-muted)] transition-transform group-open:rotate-45">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </summary>
          <div className="grid gap-5 border-t border-[var(--color-border)] p-6 sm:grid-cols-2">
            <Field label={t("commissionModel")} id="commissionType">
              <Select
                id="commissionType"
                name="commissionType"
                defaultValue={initial?.commissionType ?? "none"}
              >
                <option value="none">{t("commissionNone")}</option>
                <option value="percentage">{t("commissionPercentage")}</option>
                <option value="fixed">{t("commissionFixed")}</option>
              </Select>
            </Field>
            <Field
              label={t("commissionValue")}
              id="commissionValue"
              hint={t("commissionValueHint")}
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
            <span aria-hidden className="text-[var(--color-asbestos)]">*</span> {tCommon("required")}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" href={cancelHref}>
              {t("cancel")}
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
