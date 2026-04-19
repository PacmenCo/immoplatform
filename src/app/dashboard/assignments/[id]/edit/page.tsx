import { notFound } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { ASSIGNMENTS, SERVICES, ServiceKey } from "@/lib/mockData";

const serviceOrder: ServiceKey[] = ["epc", "asbestos", "electrical", "fuel"];

export default async function EditAssignment({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();
  const assignment = ASSIGNMENTS.find((a) => a.id === id);
  if (!assignment) notFound();

  return (
    <>
      <Topbar
        title={`Edit ${assignment.reference}`}
        subtitle={`${assignment.address}, ${assignment.postal} ${assignment.city}`}
      />

      <div className="px-8 pt-6">
        <Tabs
          tabs={[
            { label: "Details", href: `/dashboard/assignments/${assignment.id}` },
            { label: "Edit", href: `/dashboard/assignments/${assignment.id}/edit`, active: true },
            { label: "Files", href: `/dashboard/assignments/${assignment.id}/files` },
            { label: "Complete", href: `/dashboard/assignments/${assignment.id}/complete` },
          ]}
        />
      </div>

      <form className="p-8 space-y-8 max-w-[960px]">
        <Card>
          <CardHeader>
            <CardTitle>Property location</CardTitle>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1">
              Where is the inspection taking place?
            </p>
          </CardHeader>
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Street + number" id="address">
                <Input id="address" defaultValue={assignment.address} />
              </Field>
            </div>
            <Field label="Postal code" id="postal">
              <Input id="postal" defaultValue={assignment.postal} />
            </Field>
            <Field label="City" id="city">
              <Input id="city" defaultValue={assignment.city} />
            </Field>
            <Field label="Property type" id="type">
              <Select id="type" defaultValue="apartment">
                <option value="house">House</option>
                <option value="apartment">Apartment</option>
                <option value="studio">Studio</option>
                <option value="studio_room">Student room</option>
                <option value="commercial">Commercial</option>
              </Select>
            </Field>
            <Field label="Construction year" id="year">
              <Input id="year" type="number" defaultValue="1985" />
            </Field>
            <Field label="Living area (m²)" id="area">
              <Input id="area" type="number" defaultValue="120" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1">
              Pick one or more. We handle scheduling and delivery.
            </p>
          </CardHeader>
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2">
              {serviceOrder.map((key) => {
                const svc = SERVICES[key];
                const checked = assignment.services.includes(key);
                return (
                  <label
                    key={key}
                    className="group relative flex cursor-pointer items-start gap-4 rounded-[var(--radius-md)] border bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                    style={{
                      borderColor: "var(--color-border)",
                      borderLeftWidth: "4px",
                      borderLeftColor: svc.color,
                    }}
                  >
                    <input
                      type="checkbox"
                      name={`service_${key}`}
                      className="mt-1 h-4 w-4 rounded border-[var(--color-border-strong)] accent-[var(--color-brand)]"
                      defaultChecked={checked}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex h-6 px-2 items-center justify-center rounded text-[10px] font-bold tracking-wider text-white"
                          style={{ backgroundColor: svc.color }}
                        >
                          {svc.short}
                        </span>
                        <span className="font-semibold text-[var(--color-ink)]">
                          {svc.label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                        {svc.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner contact</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Full name" id="owner-name">
                <Input id="owner-name" defaultValue={assignment.owner.name} />
              </Field>
            </div>
            <Field label="Email" id="owner-email">
              <Input
                id="owner-email"
                type="email"
                defaultValue={assignment.owner.email}
              />
            </Field>
            <Field label="Phone" id="owner-phone">
              <Input id="owner-phone" defaultValue={assignment.owner.phone} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenant contact</CardTitle>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1">
              Optional, if the property is occupied.
            </p>
          </CardHeader>
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Full name" id="tenant-name">
                <Input
                  id="tenant-name"
                  defaultValue={assignment.tenant?.name ?? ""}
                />
              </Field>
            </div>
            <Field label="Email" id="tenant-email">
              <Input
                id="tenant-email"
                type="email"
                defaultValue={assignment.tenant?.email ?? ""}
              />
            </Field>
            <Field label="Phone" id="tenant-phone">
              <Input
                id="tenant-phone"
                defaultValue={assignment.tenant?.phone ?? ""}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduling</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Preferred date"
              id="preferred-date"
              hint="We'll confirm within 24 hours."
            >
              <Input
                id="preferred-date"
                type="date"
                defaultValue={assignment.preferredDate}
              />
            </Field>
            <Field label="Key pickup" id="key-pickup">
              <Select id="key-pickup" defaultValue="owner">
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
                  rows={4}
                  defaultValue={assignment.notes ?? ""}
                  placeholder="Parking, access codes, pets, anything worth knowing."
                />
              </Field>
            </div>
          </CardBody>
        </Card>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-6">
          <Button
            variant="ghost"
            size="md"
            href={`/dashboard/assignments/${assignment.id}`}
          >
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="md">
              Save as draft
            </Button>
            <Button type="submit" size="md">
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
