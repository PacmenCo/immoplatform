import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Select, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TEAMS } from "@/lib/mockData";
import { requireRoleOrRedirect } from "@/lib/auth";
import { SettingsNav } from "../_nav";
import { SettingsScopeBanner } from "@/components/dashboard/SettingsScopeBanner";

const PREFS = [
  {
    id: "pf_auto_assign",
    label: "Auto-assign new requests to available freelancer",
    hint: "We pick the closest freelancer with capacity within 24h.",
    defaultChecked: true,
  },
  {
    id: "pf_weekend",
    label: "Allow weekend inspections",
    hint: "Saturday & Sunday slots are offered to clients.",
    defaultChecked: false,
  },
  {
    id: "pf_combine",
    label: "Combine services into a single visit when possible",
    hint: "Schedule EPC + AIV together when both are ordered.",
    defaultChecked: true,
  },
  {
    id: "pf_digest",
    label: "Send team daily digest",
    hint: "A morning summary email to all team admins.",
    defaultChecked: true,
  },
];

export default async function TeamSettingsPage() {
  await requireRoleOrRedirect(["admin", "staff", "realtor"], "teams");
  return (
    <>
      <Topbar title="Team preferences" subtitle="Defaults and scheduling behaviour for your current team" />

      <div className="p-8 max-w-[960px]">
        <SettingsNav />
        <div className="mt-6 space-y-8">
          <SettingsScopeBanner scope="org" />
          <Card>
          <CardHeader>
            <CardTitle>Current team</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              You&apos;re a member of multiple teams — pick the one that opens by default.
            </p>
          </CardHeader>
          <CardBody>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Default team on sign-in" id="default-team">
                <Select id="default-team" defaultValue={TEAMS[0].id}>
                  {TEAMS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.city}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Active team" id="active-team" hint="Switch without changing the default.">
                <Select id="active-team" defaultValue={TEAMS[0].id}>
                  {TEAMS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="mt-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
                Your memberships
              </p>
              <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
                {TEAMS.slice(0, 3).map((t, i) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.logo}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                          {t.name}
                        </p>
                        <p className="text-xs text-[var(--color-ink-muted)]">
                          {t.city} · {t.members} members
                        </p>
                      </div>
                    </div>
                    {i === 0 ? (
                      <Badge
                        bg="color-mix(in srgb, var(--color-epc) 14%, var(--color-bg))"
                        fg="var(--color-epc)"
                      >
                        Default
                      </Badge>
                    ) : (
                      <Button variant="ghost" size="sm">Switch</Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduling preferences</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-[var(--color-border)]">
              {PREFS.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-4 py-4">
                  <div>
                    <label htmlFor={p.id} className="text-sm font-medium text-[var(--color-ink)]">
                      {p.label}
                    </label>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{p.hint}</p>
                  </div>
                  <input
                    id={p.id}
                    type="checkbox"
                    defaultChecked={p.defaultChecked}
                    className="mt-1 h-4 w-4 rounded border-[var(--color-border-strong)] accent-[var(--color-brand)]"
                  />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Working hours</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Clients will only see slots within these hours.
            </p>
          </CardHeader>
          <CardBody>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Start time" id="start-time">
                <Input id="start-time" type="time" defaultValue="08:00" />
              </Field>
              <Field label="End time" id="end-time">
                <Input id="end-time" type="time" defaultValue="18:00" />
              </Field>
            </div>
          </CardBody>
        </Card>

          <div className="sticky bottom-0 z-20 -mx-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg)]/80 sm:-mx-8 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">Team preferences</p>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Applies to everyone in this team.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">Discard</Button>
                <Button variant="primary" size="sm">Save preferences</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
