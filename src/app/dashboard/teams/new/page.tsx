import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ServicePill } from "@/components/ui/Badge";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { IconCheck, IconPlus } from "@/components/ui/Icons";
import { SERVICES } from "@/lib/mockData";

export default function NewTeamPage() {
  const serviceKeys = Object.keys(SERVICES) as (keyof typeof SERVICES)[];

  return (
    <>
      <Topbar title="Create team" subtitle="Add a new partner office to the platform" />

      <div className="p-8 max-w-[960px] space-y-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-[var(--color-ink-muted)]">Fill in the team basics. You can refine permissions and pricing after the team is created.</p>
          <div className="flex items-center gap-2">
            <Button href="/dashboard/teams" variant="ghost" size="sm">Cancel</Button>
            <Button size="sm"><IconCheck size={14} />Save team</Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
          <CardBody className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Team logo" hint="PNG or SVG, square">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] p-8 text-center hover:border-[var(--color-brand)]">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]">
                    <IconPlus size={20} />
                  </div>
                  <span className="text-sm text-[var(--color-ink-soft)]">Drop logo here or click to upload</span>
                  <input type="file" accept="image/*" className="hidden" />
                </label>
              </Field>
              <Field label="Signature image" hint="Used on issued certificates">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] p-8 text-center hover:border-[var(--color-brand)]">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]">
                    <IconPlus size={20} />
                  </div>
                  <span className="text-sm text-[var(--color-ink-soft)]">Drop signature here</span>
                  <input type="file" accept="image/*" className="hidden" />
                </label>
              </Field>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Display name" id="t-name">
                <Input id="t-name" placeholder="e.g. Vastgoed Antwerp" />
              </Field>
              <Field label="City" id="t-city">
                <Input id="t-city" placeholder="e.g. Antwerpen" />
              </Field>
              <Field label="Legal name" id="t-legal">
                <Input id="t-legal" placeholder="Legal entity name" />
              </Field>
              <Field label="VAT number" id="t-vat">
                <Input id="t-vat" placeholder="BE 0xxx.xxx.xxx" />
              </Field>
              <Field label="Chamber of Commerce number" id="t-kbo">
                <Input id="t-kbo" placeholder="0xxxxxxxxx" />
              </Field>
              <Field label="Billing email" id="t-mail">
                <Input id="t-mail" type="email" placeholder="billing@team.be" />
              </Field>
            </div>

            <Field label="Billing address" id="t-addr">
              <Textarea id="t-addr" rows={3} placeholder="Street, number&#10;Postal code, city&#10;Country" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Members</CardTitle></CardHeader>
          <CardBody>
            <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-alt)] p-8 text-center">
              <p className="text-sm text-[var(--color-ink-soft)]">No members yet</p>
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Invite your first team member after saving the team.</p>
              <Button size="sm" variant="secondary" className="mt-4"><IconPlus size={14} />Invite member</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Service permissions</CardTitle></CardHeader>
          <CardBody>
            <ul className="divide-y divide-[var(--color-border)]">
              {serviceKeys.map((key) => {
                const s = SERVICES[key];
                return (
                  <li key={key} className="flex items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-3">
                      <ServicePill color={s.color} label={s.short} />
                      <div>
                        <div className="text-sm font-medium text-[var(--color-ink)]">{s.label}</div>
                        <div className="text-xs text-[var(--color-ink-muted)]">{s.description}</div>
                      </div>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-3">
                      <span className="relative inline-block h-6 w-11 rounded-full bg-[var(--color-border-strong)]">
                        <input type="checkbox" defaultChecked className="peer sr-only" />
                        <span className="absolute inset-0 rounded-full bg-[var(--color-border-strong)] peer-checked:bg-[var(--color-brand)] transition-colors" />
                        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[var(--color-bg)] shadow-sm peer-checked:translate-x-5 transition-transform" />
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Commission configuration</CardTitle></CardHeader>
          <CardBody className="space-y-6">
            <fieldset className="grid gap-3 md:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-border-strong)] p-4 hover:border-[var(--color-brand)]">
                <input type="radio" name="new-commission" defaultChecked className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-[var(--color-ink)]">Percentage</div>
                  <div className="text-xs text-[var(--color-ink-muted)]">A share of the assignment price</div>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-border-strong)] p-4 hover:border-[var(--color-brand)]">
                <input type="radio" name="new-commission" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-[var(--color-ink)]">Fixed amount</div>
                  <div className="text-xs text-[var(--color-ink-muted)]">A flat fee per assignment</div>
                </div>
              </label>
            </fieldset>
            <Field label="Amount" id="n-amount" hint="Percentage or euro amount">
              <Input id="n-amount" type="number" placeholder="15" className="max-w-[200px]" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Price list overrides</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Service</th>
                  <th className="px-6 py-3 text-left font-medium">Master price</th>
                  <th className="px-6 py-3 text-left font-medium">Team override</th>
                </tr>
              </thead>
              <tbody>
                {serviceKeys.map((key, i) => {
                  const s = SERVICES[key];
                  const master = [165, 245, 195, 135][i];
                  return (
                    <tr key={key} className="border-t border-[var(--color-border)]">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <ServicePill color={s.color} label={s.short} />
                          <span className="font-medium text-[var(--color-ink)]">{s.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-[var(--color-ink-soft)]">€ {master}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-[var(--color-ink-muted)] text-sm">€</span>
                          <Input type="number" placeholder="—" className="h-9 max-w-[140px]" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button href="/dashboard/teams" variant="ghost" size="md">Cancel</Button>
          <Button size="md"><IconCheck size={16} />Save team</Button>
        </div>
      </div>
    </>
  );
}
