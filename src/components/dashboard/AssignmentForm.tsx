"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dropzone } from "@/components/ui/Dropzone";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
import { useTranslateError } from "@/i18n/error";
import { FILE_CONSTRAINTS, MAX_REALTOR_FILES_AT_CREATE } from "@/lib/file-constraints";
import { formatPricelistItemPrice } from "@/lib/format";
import type { OdooPricelistItem } from "@/lib/odoo";
import type { ActionResult } from "@/app/actions/_types";

type ServiceRow = {
  key: string;
  label: string;
  short: string;
  color: string;
  description: string;
};

type OwnerContact = {
  name: string;
  email: string | null;
  phone: string | null;
  // Owner invoicing fields — Platform parity (AssignmentController.php:162-164).
  // Shown in the "Invoicing details" card below the Owner section.
  address: string | null;
  postal: string | null;
  city: string | null;
  vatNumber: string | null;
};
type TenantContact = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type AssignmentFormInitial = {
  address: string;
  city: string;
  postal: string;
  propertyType: string | null;
  constructionYear: number | null;
  areaM2: number | null;
  isLargeProperty: boolean;
  services: string[];
  /** Previously-picked Odoo product id per service (asbestos for now). Keys
   *  are service keys. Used to default the typeahead selection on edit. */
  serviceProducts?: Record<string, number | null>;
  owner: OwnerContact;
  /** 'owner' (particulier) vs 'firm' (bedrijf). Drives invoice routing. */
  clientType: "owner" | "firm" | null;
  tenant: TenantContact;
  contactEmail: string | null;
  contactPhone: string | null;
  photographerContactPerson: string | null;
  preferredDate: string | null;
  calendarDate: string | null;
  calendarAccountEmail: string | null;
  // Key-pickup triple — Platform parity (edit.blade.php:778-825).
  // `requiresKeyPickup=false` hides the whole block; `locationType='other'`
  // shows the address textarea; `locationType='office'` does not.
  requiresKeyPickup: boolean;
  keyPickupLocationType: "office" | "other" | null;
  keyPickupAddress: string | null;
  notes: string | null;
  freelancerId: string | null;
  discount?: {
    type: "percentage" | "fixed" | null;
    value: number | null;
    reason: string | null;
  };
};

export type FreelancerOption = {
  id: string;
  firstName: string;
  lastName: string;
  region: string | null;
};

type Props = {
  services: ServiceRow[];
  action: (
    prev: ActionResult | undefined,
    formData: FormData,
  ) => Promise<ActionResult>;
  initial?: AssignmentFormInitial;
  submitLabel?: string;
  /** Render admin/staff-only fields (discount editor). */
  canSetDiscount?: boolean;
  /** Render the freelancer picker — admin/staff only (Platform parity). */
  canSetFreelancer?: boolean;
  freelancers?: FreelancerOption[];
  /**
   * Render the create-time supporting-files dropzone. Only shown when the
   * caller is an admin/staff or a realtor creating their own row — matches
   * Platform's `makelaar_files[]` Filepond input on the create blade. The
   * dropzone is hidden on edit (initial != null); files are managed via
   * the Files tab there.
   */
  canUploadFiles?: boolean;
  /**
   * Assignment.updatedAt at the moment the edit page rendered, ISO-stringified.
   * Carried as a hidden `loaded-at` input — the server action uses it as an
   * optimistic-lock predicate so a concurrent edit (another tab / admin) is
   * surfaced as a stale-snapshot error instead of silently clobbered. Edit
   * form only — omit on the create form, where there's no row yet to lock.
   */
  loadedAt?: string;
  /**
   * Live Odoo pricelist items per service — only services bound to a
   * pricelist appear as keys (currently `asbestos`). When a service in this
   * map is checked, a typeahead picker reveals below it so the user can
   * choose the specific Odoo product/SKU. Empty / missing service ⇒ no
   * picker, fall back to the team's flat override / base price.
   */
  pricelistItemsByService?: Record<string, PricelistItemOption[]>;
  /**
   * When the team has bindings but the Odoo round-trip failed, the page
   * passes the error message down so the form can surface a banner —
   * otherwise an "Odoo unreachable" admin sees no picker and assumes the
   * team simply isn't bound. Null = no error (or no bindings to begin with).
   */
  odooError?: string | null;
  /**
   * Render every input as disabled and hide the Save/Cancel footer. Used by
   * the merged assignment page for view-only realtors (team members who
   * pass canViewAssignment but not canEditAssignment) — they see the same
   * card layout as editors but can't change anything.
   */
  readOnly?: boolean;
};

export type PricelistItemOption = OdooPricelistItem;

export function AssignmentForm({
  services,
  action,
  initial,
  submitLabel,
  canSetDiscount,
  canSetFreelancer,
  freelancers,
  canUploadFiles,
  loadedAt,
  pricelistItemsByService,
  odooError,
  readOnly = false,
}: Props) {
  const t = useTranslations("dashboard.shared.assignmentForm");
  const tErr = useTranslateError();
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedChanges(useFormDirty(formRef));

  // Per-field validation errors keyed by Zod schema field name (camelCase).
  // Threaded into <Field error={…}> so the offending input gets a red border
  // + inline message instead of the user having to hunt for it via the
  // single banner copy.
  const fieldErrors =
    state && !state.ok && state.fields ? state.fields : undefined;

  // Key-pickup triple state — drives the conditional reveals. Mirror of
  // Platform's Alpine.js block in edit.blade.php:778-824: checkbox toggles
  // the whole section, location_type radio toggles the address textarea.
  const [requiresKeyPickup, setRequiresKeyPickup] = useState(
    initial?.requiresKeyPickup ?? false,
  );

  // Owner type drives the conditional VAT field. "owner" = Particulier
  // (private individual), "firm" = Bedrijf (company). Defaults to "owner"
  // per product call — most assignments are private property owners. Only
  // firms need the BTW (VAT) number, so we hide it when "owner" is picked.
  const [clientType, setClientType] = useState<"owner" | "firm">(
    initial?.clientType ?? "owner",
  );
  const [keyPickupLocationType, setKeyPickupLocationType] = useState<
    "office" | "other"
  >(initial?.keyPickupLocationType ?? "office");


  // Create-time supporting files. Only ever populated when the form is in
  // create mode and the caller can upload (canUploadFiles true). Reusing
  // FileUploadForm's style: a controlled file array kept in sync with the
  // Dropzone's hidden <input>, posted under name=`makelaar-file` so the
  // create action can fan it out to uploadAssignmentFilesInner.
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const showCreateUpload = !initial && !!canUploadFiles;
  const realtorConstraints = FILE_CONSTRAINTS.realtor;

  const submitCopy =
    submitLabel ?? (initial ? t("submitEdit") : t("submitCreate"));

  // Submit via `onSubmit` rather than `<form action={formAction}>`. React 19
  // automatically calls `requestFormReset` whenever a form's `action` prop is
  // a function, which restores every uncontrolled input to its original
  // `defaultValue` when the action returns. On a validation failure (e.g.
  // "Planned date can't be in the past") the user would see the form bounce
  // back to the as-loaded values and lose every edit they just made. By
  // handling submit manually and dispatching `formAction` inside a transition,
  // we keep `useActionState`'s pending/error state but skip the auto-reset.
  return (
    <form
      ref={formRef}
      onSubmit={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(() => {
                formAction(fd);
              });
            }
      }
      className="max-w-[960px] p-8 pb-28 space-y-8"
    >
      {/* `<fieldset disabled>` cascades the disabled state to every input,
          select, textarea, and button inside — native HTML behavior, no
          per-input prop plumbing needed. `display: contents` (Tailwind
          `contents`) hides the fieldset's box from layout so the cards
          render identically to the editable form. */}
      <fieldset disabled={readOnly} className="contents">
      {/*
        Optimistic-lock witness — the server action reads this back as the
        `where: { updatedAt }` predicate so a concurrent save (another tab /
        admin) gets rejected with a "Someone else just edited" error instead
        of silently overwriting the other side's fields. Only rendered when
        the parent passes a value (edit page); the create form omits it.
        Skipped in read-only render — there's no submit to lock.
      */}
      {loadedAt && !readOnly && (
        <input type="hidden" name="loaded-at" value={loadedAt} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {t("servicesTitle")}
            <span aria-hidden className="ml-0.5 text-[var(--color-asbestos)]">*</span>
          </CardTitle>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">
            {t("servicesSubtitle")}
          </p>
        </CardHeader>
        <CardBody>
          {odooError && (
            <div
              role="status"
              className="mb-4 rounded-md border border-[var(--color-electrical)]/30 bg-[color-mix(in_srgb,var(--color-electrical)_6%,var(--color-bg))] px-3 py-2 text-xs text-[var(--color-electrical)]"
            >
              {t("odooUnreachable")}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((svc) => {
              const items = pricelistItemsByService?.[svc.key];
              const hasPicker = !!items && items.length > 0;
              return (
                // `group` + `has-[:checked]` reveals the picker via CSS so we
                // don't carry a parallel React Set for checkbox state.
                <div key={svc.key} className="group/svc space-y-3">
                  <label
                    className="relative flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border bg-[var(--color-bg)] p-4 transition-all has-[:checked]:shadow-[var(--shadow-md)] has-[:checked]:bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
                    style={{
                      borderColor: "var(--color-border)",
                      borderLeftWidth: "4px",
                      borderLeftColor: svc.color,
                    }}
                  >
                    <input
                      type="checkbox"
                      name={`service_${svc.key}`}
                      defaultChecked={initial?.services.includes(svc.key) ?? false}
                      className="peer mt-0.5 h-4 w-4 rounded border-[var(--color-border-strong)] accent-[var(--color-brand)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex h-5 items-center justify-center rounded px-1.5 text-[10px] font-bold tracking-wider text-white"
                          style={{ backgroundColor: svc.color }}
                        >
                          {svc.short}
                        </span>
                        <span className="text-sm font-semibold text-[var(--color-ink)]">
                          {svc.label}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-ink-soft)]">
                        {svc.description}
                      </p>
                    </div>
                  </label>
                  {hasPicker && (
                    <div className="hidden group-has-[:checked]/svc:block">
                      <PricelistItemPicker
                        serviceKey={svc.key}
                        items={items}
                        initialId={initial?.serviceProducts?.[svc.key] ?? null}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("propertyTitle")}</CardTitle>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">
            {t("propertySubtitle")}
          </p>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <Field label={t("address")} id="address" required error={fieldErrors?.address}>
              <Input
                id="address"
                name="address"
                placeholder={t("addressPlaceholder")}
                defaultValue={initial?.address ?? ""}
                autoComplete="off"
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t("postal")} id="postal" required error={fieldErrors?.postal}>
              <Input
                id="postal"
                name="postal"
                placeholder={t("postalPlaceholder")}
                defaultValue={initial?.postal ?? ""}
                autoComplete="off"
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-4">
            <Field label={t("city")} id="city" required error={fieldErrors?.city}>
              <Input
                id="city"
                name="city"
                placeholder={t("cityPlaceholder")}
                defaultValue={initial?.city ?? ""}
                autoComplete="off"
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t("propertyType")} id="type" error={fieldErrors?.propertyType}>
              <Select
                id="type"
                name="type"
                defaultValue={initial?.propertyType ?? "apartment"}
              >
                <option value="house">{t("propertyTypeHouse")}</option>
                <option value="apartment">{t("propertyTypeApartment")}</option>
                <option value="studio">{t("propertyTypeStudio")}</option>
                <option value="studio_room">{t("propertyTypeStudioRoom")}</option>
                <option value="commercial">{t("propertyTypeCommercial")}</option>
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t("year")} id="year" error={fieldErrors?.constructionYear}>
              <Input
                id="year"
                name="year"
                type="number"
                placeholder={t("yearPlaceholder")}
                defaultValue={initial?.constructionYear ?? ""}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t("area")} id="area" error={fieldErrors?.areaM2}>
              <Input
                id="area"
                name="area"
                type="number"
                placeholder={t("areaPlaceholder")}
                defaultValue={initial?.areaM2 ?? ""}
              />
            </Field>
          </div>
          {/* "Large property (> 300 m²)" checkbox intentionally hidden for
              now (product call). The DB column + server schema + pricing
              surcharge logic stay intact; the form submits without the field
              and the server defaults it to false. Re-render the <div> block
              to expose it again. */}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <span
              id="photographer-contact-person-label"
              className="text-sm font-medium text-[var(--color-ink)]"
            >
              {t("photographerLabel")}
            </span>
            <div
              role="radiogroup"
              aria-labelledby="photographer-contact-person-label"
              className="flex flex-wrap items-center gap-x-6 gap-y-2"
            >
              {(
                [
                  ["realtor", t("photographerRealtor")],
                  ["owner", t("photographerOwner")],
                  ["tenant", t("photographerTenant")],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="inline-flex items-center gap-2 text-sm text-[var(--color-ink)]"
                >
                  <input
                    type="radio"
                    name="photographerContactPerson"
                    value={value}
                    defaultChecked={initial?.photographerContactPerson === value}
                    className="h-4 w-4 accent-[var(--color-brand)]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("contactTitle")}</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {t("contactSubtitle")}
          </p>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field label={t("contactEmail")} id="contact-email" error={fieldErrors?.contactEmail}>
            <Input
              id="contact-email"
              name="contactEmail"
              type="email"
              placeholder={t("contactEmailPlaceholder")}
              defaultValue={initial?.contactEmail ?? ""}
              autoComplete="off"
            />
          </Field>
          <Field label={t("contactPhone")} id="contact-phone" error={fieldErrors?.contactPhone}>
            <Input
              id="contact-phone"
              name="contactPhone"
              placeholder={t("contactPhonePlaceholder")}
              defaultValue={initial?.contactPhone ?? ""}
              autoComplete="off"
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("ownerTitle")}</CardTitle>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">
            {t("ownerSubtitle")}
          </p>
        </CardHeader>
        <CardBody className="space-y-5">
          {/* Particulier vs Bedrijf radio. Drives invoice routing AND the
              conditional VAT field below. Submitted under name="client-type"
              (same key as before — the old Select dropdown is gone). */}
          <div
            className="flex items-center gap-6"
            role="radiogroup"
            aria-label={t("ownerTypeAriaLabel")}
          >
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="client-type"
                value="owner"
                checked={clientType === "owner"}
                onChange={() => setClientType("owner")}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              <span className="font-medium text-[var(--color-ink)]">
                {t("ownerParticulier")}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="client-type"
                value="firm"
                checked={clientType === "firm"}
                onChange={() => setClientType("firm")}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              <span className="font-medium text-[var(--color-ink)]">
                {t("ownerFirm")}
              </span>
            </label>
          </div>

          <Field label={t("ownerFullName")} id="owner-name" required error={fieldErrors?.ownerName}>
            <Input
              id="owner-name"
              name="owner-name"
              placeholder={t("ownerFullNamePlaceholder")}
              defaultValue={initial?.owner.name ?? ""}
              autoComplete="off"
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("ownerEmail")} id="owner-email" error={fieldErrors?.ownerEmail}>
              <Input
                id="owner-email"
                name="owner-email"
                type="email"
                placeholder={t("ownerEmailPlaceholder")}
                defaultValue={initial?.owner.email ?? ""}
                autoComplete="off"
              />
            </Field>
            <Field label={t("ownerPhone")} id="owner-phone" error={fieldErrors?.ownerPhone}>
              <Input
                id="owner-phone"
                name="owner-phone"
                placeholder={t("ownerPhonePlaceholder")}
                defaultValue={initial?.owner.phone ?? ""}
                autoComplete="off"
              />
            </Field>
          </div>

          <Field label={t("ownerAddress")} id="owner-address" error={fieldErrors?.ownerAddress}>
            <Input
              id="owner-address"
              name="owner-address"
              placeholder={t("ownerAddressPlaceholder")}
              defaultValue={initial?.owner.address ?? ""}
              autoComplete="off"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("ownerCity")} id="owner-city" error={fieldErrors?.ownerCity}>
              <Input
                id="owner-city"
                name="owner-city"
                placeholder={t("ownerCityPlaceholder")}
                defaultValue={initial?.owner.city ?? ""}
                autoComplete="off"
              />
            </Field>
            <Field label={t("ownerPostal")} id="owner-postal" error={fieldErrors?.ownerPostal}>
              <Input
                id="owner-postal"
                name="owner-postal"
                placeholder={t("ownerPostalPlaceholder")}
                defaultValue={initial?.owner.postal ?? ""}
                autoComplete="off"
              />
            </Field>
          </div>

          {/* VAT only relevant when the owner is a Bedrijf (company).
              Hidden when Particulier — the field is uncontrolled (defaultValue),
              so a previously-set BTW value is preserved on the row when the
              user toggles back to Bedrijf, and is silently dropped from the
              submitted FormData when Particulier (we omit the input). */}
          {clientType === "firm" && (
            <Field
              label={t("ownerVat")}
              id="owner-vat"
              hint={t("ownerVatHint")}
              error={fieldErrors?.ownerVatNumber}
            >
              <Input
                id="owner-vat"
                name="owner-vat"
                placeholder={t("ownerVatPlaceholder")}
                defaultValue={initial?.owner.vatNumber ?? ""}
                autoComplete="off"
              />
            </Field>
          )}
        </CardBody>
      </Card>

      <details
        className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]"
        open={!!initial?.tenant.name}
      >
        <summary className="flex cursor-pointer items-center justify-between p-6 [&::-webkit-details-marker]:hidden">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-ink)]">{t("tenantTitle")}</h3>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {t("tenantSubtitle")}
            </p>
          </div>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-ink-muted)] transition-transform group-open:rotate-45">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </summary>
        <div className="grid gap-5 border-t border-[var(--color-border)] p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t("tenantFullName")} id="tenant-name" error={fieldErrors?.tenantName}>
              <Input
                id="tenant-name"
                name="tenant-name"
                placeholder={t("tenantFullNamePlaceholder")}
                defaultValue={initial?.tenant.name ?? ""}
                autoComplete="off"
              />
            </Field>
          </div>
          <Field label={t("tenantEmail")} id="tenant-email" error={fieldErrors?.tenantEmail}>
            <Input
              id="tenant-email"
              name="tenant-email"
              type="email"
              placeholder={t("tenantEmailPlaceholder")}
              defaultValue={initial?.tenant.email ?? ""}
              autoComplete="off"
            />
          </Field>
          <Field label={t("tenantPhone")} id="tenant-phone" error={fieldErrors?.tenantPhone}>
            <Input
              id="tenant-phone"
              name="tenant-phone"
              placeholder={t("tenantPhonePlaceholder")}
              defaultValue={initial?.tenant.phone ?? ""}
              autoComplete="off"
            />
          </Field>
        </div>
      </details>

      <Card>
        <CardHeader>
          <CardTitle>{t("schedulingTitle")}</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t("plannedDate")}
            id="preferred-date"
            hint={t("plannedDateHint")}
            error={fieldErrors?.preferredDate}
          >
            <Input
              id="preferred-date"
              name="preferred-date"
              type="date"
              defaultValue={initial?.preferredDate ?? ""}
            />
          </Field>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <input
                type="checkbox"
                name="requiresKeyPickup"
                checked={requiresKeyPickup}
                onChange={(e) => setRequiresKeyPickup(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              {t("keyPickup")}
            </label>
            {requiresKeyPickup && (
              <div className="mt-4 ml-6 space-y-4 rounded-lg bg-[var(--color-bg-muted)] p-4">
                <fieldset>
                  <legend className="text-sm font-medium text-[var(--color-ink)]">
                    {t("keyPickupWhere")}
                  </legend>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                      <input
                        type="radio"
                        name="keyPickupLocationType"
                        value="office"
                        checked={keyPickupLocationType === "office"}
                        onChange={() => setKeyPickupLocationType("office")}
                        className="h-4 w-4 accent-[var(--color-brand)]"
                      />
                      {t("keyPickupOffice")}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                      <input
                        type="radio"
                        name="keyPickupLocationType"
                        value="other"
                        checked={keyPickupLocationType === "other"}
                        onChange={() => setKeyPickupLocationType("other")}
                        className="h-4 w-4 accent-[var(--color-brand)]"
                      />
                      {t("keyPickupOther")}
                    </label>
                  </div>
                </fieldset>
                {keyPickupLocationType === "other" && (
                  <Field
                    label={t("keyPickupAddress")}
                    id="key-pickup-address"
                    hint={t("keyPickupAddressHint")}
                    error={fieldErrors?.keyPickupAddress}
                  >
                    <Textarea
                      id="key-pickup-address"
                      name="keyPickupAddress"
                      rows={3}
                      placeholder={t("keyPickupAddressPlaceholder")}
                      defaultValue={initial?.keyPickupAddress ?? ""}
                    />
                  </Field>
                )}
              </div>
            )}
          </div>
          {canSetFreelancer && freelancers && (
            <div className="sm:col-span-2">
              <Field
                label={t("freelancer")}
                id="freelancer-id"
                hint={t("freelancerHint")}
              >
                <Select
                  id="freelancer-id"
                  name="freelancerId"
                  defaultValue={initial?.freelancerId ?? ""}
                >
                  <option value="">{t("freelancerUnassigned")}</option>
                  {freelancers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.firstName} {f.lastName}
                      {f.region ? ` · ${f.region}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          {canSetFreelancer && (
            <>
              <Field
                label={t("calendarDate")}
                id="calendar-date"
                hint={t("calendarDateHint")}
                error={fieldErrors?.calendarDate}
              >
                <Input
                  id="calendar-date"
                  name="calendarDate"
                  type="datetime-local"
                  defaultValue={initial?.calendarDate ?? ""}
                />
              </Field>
              <Field
                label={t("calendarAccount")}
                id="calendar-account-email"
                hint={t("calendarAccountHint")}
                error={fieldErrors?.calendarAccountEmail}
              >
                <Input
                  id="calendar-account-email"
                  name="calendarAccountEmail"
                  type="email"
                  placeholder={t("calendarAccountPlaceholder")}
                  defaultValue={initial?.calendarAccountEmail ?? ""}
                />
              </Field>
            </>
          )}
          <div className="sm:col-span-2">
            <Field label={t("notes")} id="notes" error={fieldErrors?.notes}>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder={t("notesPlaceholder")}
                defaultValue={initial?.notes ?? ""}
              />
            </Field>
          </div>
          {!initial && (
            <div className="sm:col-span-2">
              <Field label={t("initialComment")} id="initial-comment" error={fieldErrors?.initialComment}>
                <Textarea
                  id="initial-comment"
                  name="initial-comment"
                  rows={3}
                  placeholder={t("initialCommentPlaceholder")}
                />
              </Field>
            </div>
          )}
        </CardBody>
      </Card>

      {showCreateUpload && (
        <Card>
          <CardHeader>
            <CardTitle>{t("filesTitle")}</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {t("filesSubtitle")}
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            {fileError && <ErrorAlert>{fileError}</ErrorAlert>}
            <Dropzone
              name="makelaar-file"
              files={createFiles}
              onChange={(next) => {
                setCreateFiles(next);
                setFileError(null);
              }}
              accept={realtorConstraints.allowedMimes.join(",")}
              hint={t("filesHint", { maxMB: realtorConstraints.maxMB, maxFiles: MAX_REALTOR_FILES_AT_CREATE })}
              label={t("filesLabel")}
              maxFiles={MAX_REALTOR_FILES_AT_CREATE}
              maxMB={realtorConstraints.maxMB}
              onError={(msg) => setFileError(msg)}
              disabled={pending}
              uploading={pending}
            />
            <p className="text-xs text-[var(--color-ink-muted)]">
              {createFiles.length === 0
                ? t("filesNone")
                : t("filesReady", { count: createFiles.length })}
            </p>
          </CardBody>
        </Card>
      )}

      {/* Discount (admin) section intentionally hidden for now (product call).
          The DB columns + server schema + pricing math stay intact; the form
          omits discount* fields and the server reads them as undefined → no
          discount applied. Re-render the <details> block to expose it again.
          The `canSetDiscount` prop + `canSetDiscount` permission helper are
          still wired, just not consumed at the UI level. */}

      {!readOnly && (
        <div className="sticky bottom-0 z-30 -mx-8 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-8 py-4">
            <p className="text-xs text-[var(--color-ink-muted)]">
              <span aria-hidden className="text-[var(--color-asbestos)]">*</span> {t("requiredHint")}
            </p>
            <div className="flex shrink-0 items-center gap-3">
              {state && !state.ok && (
                <p
                  role="alert"
                  className="flex min-w-0 items-center gap-1.5 rounded-md bg-[var(--color-asbestos)] px-3 py-2 text-sm font-medium text-white shadow-sm"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                    className="shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <span className="truncate">{tErr(state.error)}</span>
                </p>
              )}
              <Button type="submit" size="md" loading={pending}>
                {submitCopy}
              </Button>
            </div>
          </div>
        </div>
      )}
      </fieldset>
    </form>
  );
}

// ─── Pricelist item typeahead ─────────────────────────────────────

/**
 * Searchable picker for a service's bound pricelist. The selection is
 * surfaced via a hidden `service_<key>_product` form field; submission stays
 * in the host form. Blur is delayed by a tick so onMouseDown on a list row
 * fires before the popover unmounts.
 */
function PricelistItemPicker({
  serviceKey,
  items,
  initialId,
}: {
  serviceKey: string;
  items: PricelistItemOption[];
  initialId: number | null;
}) {
  const t = useTranslations("dashboard.shared.assignmentForm");
  const [selectedId, setSelectedId] = useState<number | null>(initialId);
  const [query, setQuery] = useState<string>(() => {
    const initial = items.find((it) => it.id === initialId);
    return initial?.productName ?? "";
  });
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Category-scoped rules can't be invoiced as a specific product, so
  // they're filtered out at the picker boundary — submitting one would
  // give us nothing to write to `odooProductTemplateId`.
  const selectable = items.filter((it) => it.productTemplateId !== null);
  const filtered = selectable.filter((it) => {
    if (!query) return true;
    return it.productName.toLowerCase().includes(query.toLowerCase());
  });
  const selectedItem =
    selectedId !== null ? selectable.find((it) => it.id === selectedId) ?? null : null;

  function pick(item: PricelistItemOption) {
    setSelectedId(item.id);
    setQuery(item.productName);
    setOpen(false);
  }

  function clear() {
    setSelectedId(null);
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] p-3">
      <label
        htmlFor={`product-${serviceKey}`}
        className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]"
      >
        {t("productLabel")}
      </label>
      <div className="relative">
        <input
          id={`product-${serviceKey}`}
          ref={inputRef}
          type="text"
          autoComplete="off"
          value={query}
          placeholder={t("productSearchPlaceholder")}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="block h-9 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 pr-8 text-sm focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/15"
        />
        {selectedId !== null && (
          <button
            type="button"
            onClick={clear}
            aria-label={t("productClearAriaLabel")}
            className="absolute inset-y-0 right-1 grid w-7 place-items-center text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            ×
          </button>
        )}
        {/* The action consumes BOTH fields. `_product` carries the Odoo
            `product.template.id` (drives invoicing); `_price` carries the
            picked rule's fixed price in cents (becomes the assignment-line
            snapshot, overriding the team-level override / base price). */}
        <input
          type="hidden"
          name={`service_${serviceKey}_product`}
          value={selectedItem?.productTemplateId ?? ""}
        />
        <input
          type="hidden"
          name={`service_${serviceKey}_price`}
          value={
            selectedItem?.computePrice === "fixed" &&
            selectedItem.fixedPriceCents !== null
              ? selectedItem.fixedPriceCents
              : ""
          }
        />
        {open && filtered.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-md)]"
          >
            {filtered.map((it) => {
              const price = formatPricelistItemPrice(it);
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // keep focus on input so blur fires after pick
                      pick(it);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-muted)] ${
                      selectedId === it.id ? "bg-[var(--color-bg-muted)]" : ""
                    }`}
                  >
                    <span className="truncate text-[var(--color-ink)]">
                      {it.productName}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--color-ink-muted)]">
                      {price}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {open && filtered.length === 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-ink-muted)]">
            {t("productNoMatches")}
          </div>
        )}
      </div>
    </div>
  );
}
