import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const PRESET_COLORS = [
  "#0f172a",
  "#1e40af",
  "#0d9488",
  "#10b981",
  "#f59e0b",
  "#e11d48",
  "#9f1239",
  "#6d28d9",
  "#0ea5e9",
  "#64748b",
];

export default function BrandingSettingsPage() {
  return (
    <>
      <Topbar title="Branding" subtitle="Logo, colors and legal identity for certificates" />

      <div className="p-8 max-w-[960px] space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Shown in the dashboard sidebar and on PDF deliverables.
            </p>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] text-lg font-bold text-[var(--color-ink-muted)]">
                VA
              </div>
              <label className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] px-4 py-6 text-center text-sm text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                <span className="font-medium">Drop logo here or click to upload</span>
                <span className="mt-1 text-xs">SVG, PNG — transparent background, max 1 MB</span>
                <input type="file" accept="image/*" className="sr-only" />
              </label>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signature</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Appears at the bottom of certificate emails and PDFs.
            </p>
          </CardHeader>
          <CardBody>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] px-4 py-6 text-center text-sm text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
              <span className="font-medium">Upload signature image</span>
              <span className="mt-1 text-xs">PNG with transparent background, max 500 KB</span>
              <input type="file" accept="image/png" className="sr-only" />
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accent color</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Used sparingly across buttons, highlights and certificate headers.
            </p>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-3">
              {PRESET_COLORS.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Select color ${c}`}
                  className="relative grid h-10 w-10 place-items-center rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: i === 0 ? "var(--color-ink)" : "transparent",
                  }}
                />
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Legal identity</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Legal name" id="legal-name">
                <Input id="legal-name" defaultValue="Vastgoed Antwerp BV" />
              </Field>
              <Field label="VAT number" id="vat">
                <Input id="vat" defaultValue="BE0123 456 789" />
              </Field>
              <Field label="KvK / company number" id="kvk">
                <Input id="kvk" placeholder="0123.456.789" />
              </Field>
              <Field label="Registered email" id="reg-email">
                <Input id="reg-email" type="email" defaultValue="billing@vastgoedantwerp.be" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Billing address" id="billing-addr">
                  <Textarea
                    id="billing-addr"
                    rows={3}
                    defaultValue={"Meir 34\n2000 Antwerpen\nBelgium"}
                  />
                </Field>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" size="md">Discard</Button>
          <Button variant="primary" size="md">Save branding</Button>
        </div>
      </div>
    </>
  );
}
