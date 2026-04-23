"use client";

import { useActionState, useRef } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
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
  quantity: number;
  isLargeProperty: boolean;
  services: string[];
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
  keyPickup: string | null;
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
  cancelHref: string;
  /** Render admin/staff-only fields (discount editor). */
  canSetDiscount?: boolean;
  /** Render the freelancer picker — admin/staff only (Platform parity). */
  canSetFreelancer?: boolean;
  freelancers?: FreelancerOption[];
};

export function AssignmentForm({
  services,
  action,
  initial,
  submitLabel,
  cancelHref,
  canSetDiscount,
  canSetFreelancer,
  freelancers,
}: Props) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedChanges(useFormDirty(formRef));

  const submitCopy =
    submitLabel ?? (initial ? "Save changes" : "Create assignment");

  return (
    <form ref={formRef} action={formAction} className="max-w-[960px] p-8 pb-28 space-y-8">
      {state && !state.ok && <ErrorAlert>{state.error}</ErrorAlert>}

      <Card>
        <CardHeader>
          <CardTitle>Property</CardTitle>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">
            Where is the inspection taking place?
          </p>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <Field label="Street + number" id="address" required>
              <Input
                id="address"
                name="address"
                placeholder="Meir 34"
                defaultValue={initial?.address ?? ""}
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Postal code" id="postal" required>
              <Input
                id="postal"
                name="postal"
                placeholder="2000"
                defaultValue={initial?.postal ?? ""}
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-4">
            <Field label="City" id="city" required>
              <Input
                id="city"
                name="city"
                placeholder="Antwerpen"
                defaultValue={initial?.city ?? ""}
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Property type" id="type">
              <Select
                id="type"
                name="type"
                defaultValue={initial?.propertyType ?? "apartment"}
              >
                <option value="house">House</option>
                <option value="apartment">Apartment</option>
                <option value="studio">Studio</option>
                <option value="studio_room">Student room</option>
                <option value="commercial">Commercial</option>
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Construction year" id="year">
              <Input
                id="year"
                name="year"
                type="number"
                placeholder="1985"
                defaultValue={initial?.constructionYear ?? ""}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Living area (m²)" id="area">
              <Input
                id="area"
                name="area"
                type="number"
                placeholder="120"
                defaultValue={initial?.areaM2 ?? ""}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Packages" id="quantity">
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                max={10}
                defaultValue={initial?.quantity ?? 1}
              />
            </Field>
          </div>
          <div className="sm:col-span-6">
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
              <input
                type="checkbox"
                name="isLargeProperty"
                defaultChecked={initial?.isLargeProperty ?? false}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              Large property (&gt; 300&nbsp;m²) — renders "Groot pand" on the
              calendar event and triggers the large-property pricing surcharge.
            </label>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Services
            <span aria-hidden className="ml-0.5 text-[var(--color-asbestos)]">*</span>
          </CardTitle>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">
            Pick one or more. We handle scheduling and delivery.
          </p>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((svc) => (
              <label
                key={svc.key}
                className="group relative flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border bg-[var(--color-bg)] p-4 transition-all has-[:checked]:shadow-[var(--shadow-md)] has-[:checked]:bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
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
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Owner</CardTitle>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">
            The person signing the assignment form.
          </p>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Full name" id="owner-name" required>
              <Input
                id="owner-name"
                name="owner-name"
                placeholder="Els Vermeulen"
                defaultValue={initial?.owner.name ?? ""}
                required
              />
            </Field>
          </div>
          <Field label="Email" id="owner-email">
            <Input
              id="owner-email"
              name="owner-email"
              type="email"
              placeholder="els@example.com"
              defaultValue={initial?.owner.email ?? ""}
            />
          </Field>
          <Field label="Phone" id="owner-phone">
            <Input
              id="owner-phone"
              name="owner-phone"
              placeholder="+32 476 12 34 56"
              defaultValue={initial?.owner.phone ?? ""}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoicing details</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Used on the invoice PDF. Leave blank to use the property address.
          </p>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label="Invoice recipient"
              id="client-type"
              hint="Particulier = billed to the owner personally. Firm = billed to the company (VAT required)."
            >
              <Select
                id="client-type"
                name="client-type"
                defaultValue={initial?.clientType ?? ""}
              >
                <option value="">Use team default</option>
                <option value="owner">Particulier (owner)</option>
                <option value="firm">Firm (bedrijf)</option>
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Owner invoicing address" id="owner-address">
              <Input
                id="owner-address"
                name="owner-address"
                placeholder="Meir 42"
                defaultValue={initial?.owner.address ?? ""}
              />
            </Field>
          </div>
          <Field label="Postal code" id="owner-postal">
            <Input
              id="owner-postal"
              name="owner-postal"
              placeholder="2000"
              defaultValue={initial?.owner.postal ?? ""}
            />
          </Field>
          <Field label="City" id="owner-city">
            <Input
              id="owner-city"
              name="owner-city"
              placeholder="Antwerpen"
              defaultValue={initial?.owner.city ?? ""}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="VAT number"
              id="owner-vat"
              hint="Required for firm invoices (e.g. BE 0712.345.678)."
            >
              <Input
                id="owner-vat"
                name="owner-vat"
                placeholder="BE 0712.345.678"
                defaultValue={initial?.owner.vatNumber ?? ""}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agency contact</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            The realtor or agency person the inspector should contact. Shown on
            the calendar event under "Makelaar".
          </p>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" id="contact-email">
            <Input
              id="contact-email"
              name="contactEmail"
              type="email"
              placeholder="info@vastgoedantwerp.be"
              defaultValue={initial?.contactEmail ?? ""}
            />
          </Field>
          <Field label="Phone" id="contact-phone">
            <Input
              id="contact-phone"
              name="contactPhone"
              placeholder="+32 3 123 45 67"
              defaultValue={initial?.contactPhone ?? ""}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Primary contact for the inspector"
              id="photographer-contact-person"
              hint="Which contact gets tagged (Jouw contactpersoon) on the calendar event."
            >
              <Select
                id="photographer-contact-person"
                name="photographerContactPerson"
                defaultValue={initial?.photographerContactPerson ?? ""}
              >
                <option value="">— Pick later —</option>
                <option value="realtor">Agency / realtor</option>
                <option value="owner">Owner</option>
                <option value="tenant">Tenant</option>
              </Select>
            </Field>
          </div>
        </CardBody>
      </Card>

      <details
        className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]"
        open={!!initial?.tenant.name}
      >
        <summary className="flex cursor-pointer items-center justify-between p-6 [&::-webkit-details-marker]:hidden">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-ink)]">Tenant</h3>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Add if the property is currently occupied — optional.
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
            <Field label="Full name" id="tenant-name">
              <Input
                id="tenant-name"
                name="tenant-name"
                placeholder="Marc De Smet"
                defaultValue={initial?.tenant.name ?? ""}
              />
            </Field>
          </div>
          <Field label="Email" id="tenant-email">
            <Input
              id="tenant-email"
              name="tenant-email"
              type="email"
              placeholder="marc@example.com"
              defaultValue={initial?.tenant.email ?? ""}
            />
          </Field>
          <Field label="Phone" id="tenant-phone">
            <Input
              id="tenant-phone"
              name="tenant-phone"
              placeholder="+32 479 98 76 54"
              defaultValue={initial?.tenant.phone ?? ""}
            />
          </Field>
        </div>
      </details>

      <Card>
        <CardHeader>
          <CardTitle>Scheduling</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Preferred date"
            id="preferred-date"
            hint="We confirm within 24 hours by email."
          >
            <Input
              id="preferred-date"
              name="preferred-date"
              type="date"
              defaultValue={initial?.preferredDate ?? ""}
            />
          </Field>
          <Field label="Key pickup" id="key-pickup">
            <Select
              id="key-pickup"
              name="key-pickup"
              defaultValue={initial?.keyPickup ?? "owner"}
            >
              <option value="owner">At owner&apos;s address</option>
              <option value="tenant">At tenant&apos;s address</option>
              <option value="office">Pick up at office</option>
              <option value="lockbox">Lockbox on-site</option>
            </Select>
          </Field>
          {canSetFreelancer && freelancers && (
            <div className="sm:col-span-2">
              <Field
                label="Assign freelancer"
                id="freelancer-id"
                hint="Optional — leave as Unassigned to assign later."
              >
                <Select
                  id="freelancer-id"
                  name="freelancerId"
                  defaultValue={initial?.freelancerId ?? ""}
                >
                  <option value="">— Unassigned —</option>
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
                label="Internal calendar date"
                id="calendar-date"
                hint="Overrides the preferred date when pushing to calendars. Customer's date stays untouched."
              >
                <Input
                  id="calendar-date"
                  name="calendarDate"
                  type="datetime-local"
                  defaultValue={initial?.calendarDate ?? ""}
                />
              </Field>
              <Field
                label="Calendar account (for email CTA)"
                id="calendar-account-email"
                hint="The Google account the email's 'Add to my calendar' button targets."
              >
                <Input
                  id="calendar-account-email"
                  name="calendarAccountEmail"
                  type="email"
                  placeholder="you@agency.be"
                  defaultValue={initial?.calendarAccountEmail ?? ""}
                />
              </Field>
            </>
          )}
          <div className="sm:col-span-2">
            <Field label="Notes for the inspector" id="notes">
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Parking, access codes, pets — anything worth knowing."
                defaultValue={initial?.notes ?? ""}
              />
            </Field>
          </div>
          {!initial && (
            <div className="sm:col-span-2">
              <Field label="Initial comment" id="initial-comment">
                <Textarea
                  id="initial-comment"
                  name="initial-comment"
                  rows={3}
                  placeholder="First message for the thread (optional) — visible to everyone on the assignment."
                />
              </Field>
            </div>
          )}
        </CardBody>
      </Card>

      {canSetDiscount && (
        <details
          className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]"
          open={!!initial?.discount?.type}
        >
          <summary className="flex cursor-pointer items-center justify-between p-6 [&::-webkit-details-marker]:hidden">
            <div>
              <h3 className="text-base font-semibold text-[var(--color-ink)]">
                Discount (admin)
              </h3>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                Applied to the post-surcharge total. Percentage is in basis points
                (1500 = 15%); fixed is in cents (2500 = €25.00).
              </p>
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-ink-muted)] transition-transform group-open:rotate-45">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </summary>
          <div className="grid gap-5 border-t border-[var(--color-border)] p-6 sm:grid-cols-3">
            <Field label="Type" id="discountType">
              <Select
                id="discountType"
                name="discountType"
                defaultValue={initial?.discount?.type ?? "none"}
              >
                <option value="none">No discount</option>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </Select>
            </Field>
            <Field label="Value" id="discountValue">
              <Input
                id="discountValue"
                name="discountValue"
                type="number"
                min={0}
                placeholder="1500"
                defaultValue={initial?.discount?.value ?? ""}
              />
            </Field>
            <Field label="Reason" id="discountReason">
              <Input
                id="discountReason"
                name="discountReason"
                placeholder="Volume deal"
                defaultValue={initial?.discount?.reason ?? ""}
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
              {submitCopy}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
