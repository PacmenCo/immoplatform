import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

const emailPrefs = [
  { id: "np_new", label: "New assignment created", defaultChecked: true },
  { id: "np_sched", label: "Assignment scheduled", defaultChecked: true },
  { id: "np_files", label: "Files uploaded", defaultChecked: true },
  { id: "np_done", label: "Assignment completed", defaultChecked: true },
  { id: "np_invoice", label: "Monthly invoice reminder", defaultChecked: true },
  { id: "np_marketing", label: "Product updates & newsletters", defaultChecked: false },
];

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" subtitle="Profile, email preferences, integrations" />

      <div className="p-8 max-w-[960px] space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="mb-6 flex items-center gap-4">
              <Avatar initials="JR" size="lg" color="#0f172a" />
              <div>
                <Button variant="secondary" size="sm">Upload photo</Button>
                <p className="mt-2 text-xs text-[var(--color-ink-muted)]">PNG or JPG, max 2 MB.</p>
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
                <Input id="phone" placeholder="+32 …" />
              </Field>
              <Field label="Language" id="lang">
                <Select id="lang" defaultValue="en">
                  <option value="en">English</option>
                  <option value="nl">Dutch</option>
                  <option value="fr">French</option>
                </Select>
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email notifications</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Choose which emails you&apos;d like to receive.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-[var(--color-border)]">
              {emailPrefs.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <label htmlFor={p.id} className="text-sm text-[var(--color-ink)]">
                    {p.label}
                  </label>
                  <input
                    id={p.id}
                    type="checkbox"
                    defaultChecked={p.defaultChecked}
                    className="h-4 w-4 rounded border-[var(--color-border-strong)] accent-[var(--color-brand)]"
                  />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Integration name="Google Calendar" description="Push assignment events to your Google Calendar." connected />
            <Integration name="Microsoft Outlook" description="Push assignment events to your Outlook calendar." />
            <Integration name="Slack" description="Get notifications in your team's Slack workspace." />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[var(--color-asbestos)]">Danger zone</CardTitle>
          </CardHeader>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[var(--color-ink)]">Delete account</p>
              <p className="text-sm text-[var(--color-ink-soft)]">
                Permanently remove your account and all associated data.
              </p>
            </div>
            <Button variant="danger" size="sm">Delete</Button>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Integration({
  name,
  description,
  connected,
}: {
  name: string;
  description: string;
  connected?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-4 py-3">
      <div>
        <p className="font-medium text-[var(--color-ink)]">{name}</p>
        <p className="text-sm text-[var(--color-ink-muted)]">{description}</p>
      </div>
      {connected ? (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--color-epc)_12%,white)] px-2.5 py-1 text-xs font-medium text-[var(--color-epc)]">
          Connected
        </span>
      ) : (
        <Button variant="secondary" size="sm">Connect</Button>
      )}
    </div>
  );
}
