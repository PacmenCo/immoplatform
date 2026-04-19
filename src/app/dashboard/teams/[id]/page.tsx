import { notFound } from "next/navigation";
import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, ServicePill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { IconPlus, IconUsers, IconMail, IconCheck } from "@/components/ui/Icons";
import { SERVICES, TEAMS, USERS } from "@/lib/mockData";

const TABS = [
  { id: "branding", label: "Branding" },
  { id: "members", label: "Members" },
  { id: "permissions", label: "Permissions" },
  { id: "commission", label: "Commission" },
  { id: "pricing", label: "Price list" },
];

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const team = TEAMS.find((t) => t.id === id);
  if (!team) notFound();

  const members = USERS.filter(
    (u) => u.team === team.name || (team.id === "t_01" && u.role === "freelancer"),
  ).slice(0, 6);

  const serviceKeys = Object.keys(SERVICES) as (keyof typeof SERVICES)[];

  return (
    <>
      <Topbar title={team.name} subtitle={`${team.city} · ${team.members} members · ${team.active} active`} />

      <div className="p-8 max-w-[1200px] space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar initials={team.logo} size="lg" color={team.color} />
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">Team</div>
              <div className="text-xl font-semibold text-[var(--color-ink)]">{team.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button href="/dashboard/teams" variant="ghost" size="sm">Back to teams</Button>
            <Button variant="secondary" size="sm">Archive</Button>
            <Button size="sm"><IconCheck size={14} />Save changes</Button>
          </div>
        </div>

        <nav className="flex items-center gap-1 border-b border-[var(--color-border)]">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`#${t.id}`}
              className="relative px-4 py-3 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] border-b-2 border-transparent hover:border-[var(--color-border-strong)]"
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <Card id="branding">
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Logo, legal details and signature for documents issued on behalf of this team.</p>
          </CardHeader>
          <CardBody className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Team logo" hint="PNG or SVG, square, min 256px">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] p-8 text-center transition-colors hover:border-[var(--color-brand)]">
                  <Avatar initials={team.logo} size="lg" color={team.color} />
                  <span className="text-sm text-[var(--color-ink-soft)]">Drop logo here or click to upload</span>
                  <span className="text-xs text-[var(--color-ink-muted)]">Current: {team.logo}.png · 48 KB</span>
                  <input type="file" accept="image/*" className="hidden" />
                </label>
              </Field>
              <Field label="Signature image" hint="Used on issued certificates">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] p-8 text-center transition-colors hover:border-[var(--color-brand)]">
                  <span className="font-serif italic text-2xl text-[var(--color-ink-soft)]">{team.name.split(" ")[0]}</span>
                  <span className="text-sm text-[var(--color-ink-soft)]">Drop signature PNG here</span>
                  <span className="text-xs text-[var(--color-ink-muted)]">Transparent background recommended</span>
                  <input type="file" accept="image/*" className="hidden" />
                </label>
              </Field>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Legal name" id="legal-name">
                <Input id="legal-name" defaultValue={`${team.name} BV`} />
              </Field>
              <Field label="VAT number" id="vat">
                <Input id="vat" defaultValue={`BE 0${team.id.replace("t_0", "7")}34.567.89${team.id.slice(-1)}`} />
              </Field>
              <Field label="Chamber of Commerce number" id="kbo">
                <Input id="kbo" defaultValue={`0${team.id.replace("t_0", "8")}34567${team.id.slice(-1)}`} />
              </Field>
              <Field label="Billing email" id="bill-email">
                <Input id="bill-email" type="email" defaultValue={`billing@${team.name.toLowerCase().replace(/ /g, "")}.be`} />
              </Field>
            </div>

            <Field label="Billing address" id="address">
              <Textarea id="address" rows={3} defaultValue={`${team.name} BV\nHoofdkantoor 12\n${team.city}, Belgium`} />
            </Field>
          </CardBody>
        </Card>

        <Card id="members">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{members.length} people have access to this team.</p>
            </div>
            <Button size="sm"><IconPlus size={14} />Invite member</Button>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Name</th>
                  <th className="px-6 py-3 text-left font-medium">Email</th>
                  <th className="px-6 py-3 text-left font-medium">Role</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-[var(--color-border)]">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={m.avatar} size="sm" online={m.online} />
                        <span className="font-medium text-[var(--color-ink)]">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-[var(--color-ink-soft)]">{m.email}</td>
                    <td className="px-6 py-3">
                      <Select defaultValue={m.role} className="h-8 text-xs">
                        <option value="admin">Admin</option>
                        <option value="realtor">Realtor</option>
                        <option value="freelancer">Freelancer</option>
                        <option value="staff">Staff</option>
                      </Select>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button variant="ghost" size="sm">Remove</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card id="permissions">
          <CardHeader>
            <CardTitle>Service permissions</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Only enabled services appear when creating assignments for this team.</p>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-[var(--color-border)]">
              {serviceKeys.map((key, i) => {
                const s = SERVICES[key];
                const enabled = i < 3;
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
                      <span className="text-xs text-[var(--color-ink-muted)]">{enabled ? "Enabled" : "Disabled"}</span>
                      <span className="relative inline-block h-6 w-11 rounded-full bg-[var(--color-border-strong)]" aria-hidden>
                        <input type="checkbox" defaultChecked={enabled} className="peer sr-only" />
                        <span className="absolute inset-0 rounded-full bg-[var(--color-border-strong)] peer-checked:bg-[var(--color-brand)] transition-colors" />
                        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm peer-checked:translate-x-5 transition-transform" />
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card id="commission">
          <CardHeader>
            <CardTitle>Commission configuration</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">How this team is rewarded per delivered assignment.</p>
          </CardHeader>
          <CardBody className="space-y-6">
            <fieldset className="grid gap-3 md:grid-cols-2">
              <legend className="mb-2 text-sm font-medium text-[var(--color-ink)]">Type</legend>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-border-strong)] p-4 hover:border-[var(--color-brand)]">
                <input type="radio" name="commission-type" defaultChecked className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-[var(--color-ink)]">Percentage</div>
                  <div className="text-xs text-[var(--color-ink-muted)]">A share of the assignment price</div>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-border-strong)] p-4 hover:border-[var(--color-brand)]">
                <input type="radio" name="commission-type" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-[var(--color-ink)]">Fixed amount</div>
                  <div className="text-xs text-[var(--color-ink-muted)]">A flat fee per assignment</div>
                </div>
              </label>
            </fieldset>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Amount" hint="Percentage or euro amount" id="commission-amount">
                <div className="flex items-center gap-2">
                  <Input id="commission-amount" type="number" defaultValue={15} className="max-w-[180px]" />
                  <span className="text-sm text-[var(--color-ink-muted)]">% of invoice total</span>
                </div>
              </Field>
              <Field label="Payout cadence" id="cadence">
                <Select id="cadence" defaultValue="monthly">
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card id="pricing">
          <CardHeader>
            <CardTitle>Price list</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Per-team overrides. Leave blank to use the master price list.</p>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Service</th>
                  <th className="px-6 py-3 text-left font-medium">Master price</th>
                  <th className="px-6 py-3 text-left font-medium">Team override</th>
                  <th className="px-6 py-3 text-left font-medium">Effective</th>
                </tr>
              </thead>
              <tbody>
                {serviceKeys.map((key, i) => {
                  const s = SERVICES[key];
                  const master = [165, 245, 195, 135][i];
                  const override = [null, 225, null, 125][i];
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
                          <Input type="number" defaultValue={override ?? undefined} placeholder="—" className="h-9 max-w-[140px]" />
                        </div>
                      </td>
                      <td className="px-6 py-3 font-semibold text-[var(--color-ink)]">€ {override ?? master}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
