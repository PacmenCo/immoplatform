import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const SESSIONS = [
  {
    id: "s_1",
    device: "MacBook Pro — Safari 18",
    location: "Antwerpen, Belgium",
    lastActive: "Active now",
    current: true,
  },
  {
    id: "s_2",
    device: "iPhone 16 — Immo iOS",
    location: "Antwerpen, Belgium",
    lastActive: "2 hours ago",
    current: false,
  },
  {
    id: "s_3",
    device: "Windows 11 — Chrome 139",
    location: "Brussels, Belgium",
    lastActive: "3 days ago",
    current: false,
  },
];

export default function SecuritySettingsPage() {
  return (
    <>
      <Topbar title="Security" subtitle="Password, 2FA and active sessions" />

      <div className="p-8 max-w-[960px] space-y-8">
        <div className="flex items-start gap-3 rounded-md border border-[color-mix(in_srgb,var(--color-electrical)_40%,var(--color-bg))] bg-[color-mix(in_srgb,var(--color-electrical)_10%,var(--color-bg))] p-4">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-electrical)] text-xs font-bold text-white">
            !
          </span>
          <div className="text-sm">
            <p className="font-medium text-[var(--color-ink)]">
              Unusual sign-in detected
            </p>
            <p className="text-[var(--color-ink-soft)]">
              A new device signed in from Brussels 3 days ago. If this wasn&apos;t you,
              change your password immediately.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Use at least 10 characters with a mix of letters, numbers and symbols.
            </p>
          </CardHeader>
          <CardBody>
            <div className="grid gap-5 sm:max-w-md">
              <Field label="Current password" id="current-pw">
                <Input id="current-pw" type="password" autoComplete="current-password" />
              </Field>
              <Field label="New password" id="new-pw" hint="At least 10 characters.">
                <Input id="new-pw" type="password" autoComplete="new-password" />
              </Field>
              <Field label="Confirm new password" id="confirm-pw">
                <Input id="confirm-pw" type="password" autoComplete="new-password" />
              </Field>
              <div>
                <Button variant="primary" size="md">Update password</Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Two-factor authentication</CardTitle>
              <Badge>Not enabled</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Protect your account with an additional step at sign-in.
            </p>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">
                  Authenticator app
                </p>
                <p className="text-sm text-[var(--color-ink-soft)]">
                  Scan a QR code with Google Authenticator, 1Password or similar.
                </p>
              </div>
              <Button variant="primary" size="md">Set up 2FA</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active sessions</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Devices currently signed in to your account.
            </p>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-[var(--color-border)]">
              {SESSIONS.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--color-ink)]">
                        {s.device}
                      </p>
                      {s.current && (
                        <Badge
                          bg="color-mix(in srgb, var(--color-epc) 14%, var(--color-bg))"
                          fg="var(--color-epc)"
                        >
                          This device
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                      {s.location} · {s.lastActive}
                    </p>
                  </div>
                  {s.current ? (
                    <span className="text-xs text-[var(--color-ink-muted)]">—</span>
                  ) : (
                    <Button variant="ghost" size="sm">Revoke</Button>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[var(--color-asbestos)]">Sign out everywhere</CardTitle>
          </CardHeader>
          <CardBody className="flex items-center justify-between gap-4">
            <p className="text-sm text-[var(--color-ink-soft)]">
              Revoke every session except this one.
            </p>
            <Button variant="danger" size="sm">Sign out all</Button>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
