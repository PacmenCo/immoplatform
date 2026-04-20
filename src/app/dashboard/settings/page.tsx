import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { IconAlert, IconTrash } from "@/components/ui/Icons";
import { SettingsNav } from "./_nav";

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" subtitle="Personal account settings" />

      <div className="p-8 max-w-[1000px]">
        <SettingsNav />

        <div className="mt-6 space-y-6">
          {/* Personal scope callout */}
          <div className="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-bg)] text-[var(--color-ink-muted)]">
              i
            </span>
            <div>
              <p className="font-medium text-[var(--color-ink)]">
                Personal settings
              </p>
              <p className="mt-0.5 text-[var(--color-ink-soft)]">
                These apply only to your account. For team-wide settings, visit{" "}
                <a
                  href="/dashboard/settings/team"
                  className="font-medium text-[var(--color-ink)] underline decoration-dotted underline-offset-2"
                >
                  Team
                </a>
                .
              </p>
            </div>
          </div>

          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Shown on comments, assignments and team pages.
              </p>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar initials="JR" size="lg" color="#0f172a" />
                <div>
                  <Button variant="secondary" size="sm">
                    Upload photo
                  </Button>
                  <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
                    PNG or JPG, max 2 MB.
                  </p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" id="name">
                  <Input id="name" defaultValue="Jordan Remy" />
                </Field>
                <Field label="Email" id="email">
                  <Input id="email" type="email" defaultValue="jordan@asbestexperts.be" />
                </Field>
                <Field label="Phone" id="phone">
                  <Input id="phone" placeholder="+32 …" defaultValue="+32 474 00 11 22" />
                </Field>
                <Field label="Timezone" id="tz">
                  <Select id="tz" defaultValue="brussels">
                    <option value="brussels">Europe/Brussels (CET)</option>
                    <option value="amsterdam">Europe/Amsterdam (CET)</option>
                    <option value="london">Europe/London (GMT)</option>
                    <option value="utc">UTC</option>
                  </Select>
                </Field>
              </div>
            </CardBody>
          </Card>

          {/* Active sessions */}
          <Card>
            <CardHeader>
              <CardTitle>Active sessions</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Devices currently signed in to your account.
              </p>
            </CardHeader>
            <CardBody>
              <ul className="divide-y divide-[var(--color-border)]">
                <SessionRow
                  device="MacBook Pro"
                  browser="Chrome 140 · macOS"
                  location="Antwerpen · today 09:42"
                  current
                />
                <SessionRow
                  device="iPhone"
                  browser="Safari · iOS 19"
                  location="Brussels · yesterday 18:12"
                />
              </ul>
              <div className="mt-4 text-right">
                <Button variant="ghost" size="sm">
                  Sign out of other sessions
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Save bar */}
          <div className="sticky bottom-0 -mx-8 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 px-8 py-4 backdrop-blur">
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="md">
                Cancel
              </Button>
              <Button size="md">Save changes</Button>
            </div>
          </div>

          {/* Danger zone */}
          <Card className="border-[var(--color-asbestos)]/40">
            <CardHeader className="border-[var(--color-asbestos)]/40">
              <div className="flex items-center gap-2">
                <IconAlert
                  size={16}
                  className="text-[var(--color-asbestos)]"
                />
                <CardTitle className="text-[var(--color-asbestos)]">
                  Danger zone
                </CardTitle>
              </div>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Actions here can&apos;t be undone. Tread carefully.
              </p>
            </CardHeader>
            <CardBody className="divide-y divide-[var(--color-border)] p-0">
              <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">
                    Transfer team ownership
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                    If you&apos;re the last owner of a team, transfer ownership before
                    leaving.
                  </p>
                </div>
                <Button variant="secondary" size="sm">
                  Transfer…
                </Button>
              </div>
              <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">Delete account</p>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                    Permanently remove your account and personal data. This cannot be
                    reversed.
                  </p>
                </div>
                <Button variant="danger" size="sm">
                  <IconTrash size={14} />
                  Delete account…
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function SessionRow({
  device,
  browser,
  location,
  current,
}: {
  device: string;
  browser: string;
  location: string;
  current?: boolean;
}) {
  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-[var(--color-ink)]">
          {device}
          {current && (
            <span className="ml-2 rounded-full bg-[color-mix(in_srgb,var(--color-epc)_14%,var(--color-bg))] px-2 py-0.5 text-[10px] font-medium text-[var(--color-epc)]">
              This device
            </span>
          )}
        </p>
        <p className="text-xs text-[var(--color-ink-muted)]">
          {browser} · {location}
        </p>
      </div>
      {!current && (
        <Button variant="ghost" size="sm">
          Sign out
        </Button>
      )}
    </li>
  );
}
