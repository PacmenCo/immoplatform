import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { IconCheck, IconMegaphone } from "@/components/ui/Icons";
import { Badge } from "@/components/ui/Badge";

export default function NewAnnouncementPage() {
  return (
    <>
      <Topbar title="New announcement" subtitle="Create a banner message for users" />

      <div className="p-8 max-w-[960px] space-y-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-[var(--color-ink-muted)]">Announcements appear at the top of the dashboard for all users within the active window.</p>
          <div className="flex items-center gap-2">
            <Button href="/dashboard/announcements" variant="ghost" size="sm">Cancel</Button>
            <Button size="sm"><IconCheck size={14} />Publish</Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Content</CardTitle></CardHeader>
          <CardBody className="space-y-6">
            <Field label="Title" id="a-title" hint="Shown in bold on the banner">
              <Input id="a-title" placeholder="e.g. Scheduled maintenance on April 20" />
            </Field>
            <Field label="Body" id="a-body" hint="One or two short sentences work best">
              <Textarea id="a-body" rows={5} placeholder="Describe what is happening, when, and what users should do." />
            </Field>
            <div className="grid gap-6 md:grid-cols-3">
              <Field label="Type" id="a-type">
                <Select id="a-type" defaultValue="info">
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                </Select>
              </Field>
              <Field label="Start date" id="a-start">
                <Input id="a-start" type="date" />
              </Field>
              <Field label="End date" id="a-end">
                <Input id="a-end" type="date" />
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Visibility</CardTitle></CardHeader>
          <CardBody>
            <label className="flex items-start gap-4">
              <span className="relative mt-1 inline-block h-6 w-11 rounded-full bg-[var(--color-border-strong)]">
                <input type="checkbox" defaultChecked className="peer sr-only" />
                <span className="absolute inset-0 rounded-full bg-[var(--color-border-strong)] peer-checked:bg-[var(--color-brand)] transition-colors" />
                <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm peer-checked:translate-x-5 transition-transform" />
              </span>
              <span>
                <span className="block text-sm font-medium text-[var(--color-ink)]">Active</span>
                <span className="block text-xs text-[var(--color-ink-muted)]">Uncheck to save this as a draft without publishing.</span>
              </span>
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardBody>
            <div className="flex items-start gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
              <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#eff6ff] text-[#1d4ed8]">
                <IconMegaphone size={18} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[var(--color-ink)]">Your title shows here</h3>
                  <Badge bg="#eff6ff" fg="#1d4ed8">Info</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Body text previews like this for all users in the active window.</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button href="/dashboard/announcements" variant="ghost" size="md">Cancel</Button>
          <Button size="md"><IconCheck size={16} />Publish announcement</Button>
        </div>
      </div>
    </>
  );
}
