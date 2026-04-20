"use client";

import { useActionState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createAssignment } from "@/app/actions/assignments";
import type { ActionResult } from "@/app/actions/invites";

type ServiceRow = {
  key: string;
  label: string;
  short: string;
  color: string;
  description: string;
};

export function NewAssignmentForm({ services }: { services: ServiceRow[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    createAssignment,
    undefined,
  );

  return (
    <form action={formAction} className="max-w-[960px] p-8 pb-28 space-y-8">
      {state && !state.ok && (
        <div
          role="alert"
          className="rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-asbestos)]"
        >
          {state.error}
        </div>
      )}

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
              <Input id="address" name="address" placeholder="Meir 34" required />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Postal code" id="postal" required>
              <Input id="postal" name="postal" placeholder="2000" required />
            </Field>
          </div>
          <div className="sm:col-span-4">
            <Field label="City" id="city" required>
              <Input id="city" name="city" placeholder="Antwerpen" required />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Property type" id="type">
              <Select id="type" name="type" defaultValue="apartment">
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
              <Input id="year" name="year" type="number" placeholder="1985" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Living area (m²)" id="area">
              <Input id="area" name="area" type="number" placeholder="120" />
            </Field>
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
            />
          </Field>
          <Field label="Phone" id="owner-phone">
            <Input
              id="owner-phone"
              name="owner-phone"
              placeholder="+32 476 12 34 56"
            />
          </Field>
        </CardBody>
      </Card>

      <Card as="details" className="group">
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
              <Input id="tenant-name" name="tenant-name" placeholder="Marc De Smet" />
            </Field>
          </div>
          <Field label="Email" id="tenant-email">
            <Input
              id="tenant-email"
              name="tenant-email"
              type="email"
              placeholder="marc@example.com"
            />
          </Field>
          <Field label="Phone" id="tenant-phone">
            <Input
              id="tenant-phone"
              name="tenant-phone"
              placeholder="+32 479 98 76 54"
            />
          </Field>
        </div>
      </Card>

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
            <Input id="preferred-date" name="preferred-date" type="date" />
          </Field>
          <Field label="Key pickup" id="key-pickup">
            <Select id="key-pickup" name="key-pickup" defaultValue="owner">
              <option value="owner">At owner&apos;s address</option>
              <option value="tenant">At tenant&apos;s address</option>
              <option value="office">Pick up at office</option>
              <option value="lockbox">Lockbox on-site</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes for the inspector" id="notes">
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Parking, access codes, pets — anything worth knowing."
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Sticky action bar — INSIDE form so Submit works */}
      <div className="sticky bottom-0 z-30 -mx-8 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-8 py-4">
          <p className="text-xs text-[var(--color-ink-muted)]">
            <span aria-hidden className="text-[var(--color-asbestos)]">*</span> Required
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" href="/dashboard/assignments">
              Cancel
            </Button>
            <Button type="submit" size="md" loading={pending}>
              Create assignment
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
