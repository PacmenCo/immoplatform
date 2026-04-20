import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconCheck } from "@/components/ui/Icons";
import { SettingsNav } from "../../_nav";

const calendars = [
  { name: "jordan@asbestexperts.be", selected: true, primary: true },
  { name: "Vastgoed Antwerp — team", selected: true, primary: false },
  { name: "Personal", selected: false, primary: false },
];

export default function GoogleCalendarIntegrationPage() {
  return (
    <>
      <Topbar title="Google Calendar" subtitle="Sync assignment dates to your calendar" />

      <div className="p-8 max-w-[1000px]">
        <SettingsNav />

        <nav aria-label="Breadcrumb" className="mt-6 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          <Link href="/dashboard/settings/integrations" className="hover:text-[var(--color-ink)]">
            Integrations
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[var(--color-ink-soft)]">Google Calendar</span>
        </nav>

        <div className="mt-6 space-y-6">
          <Card>
            <CardBody className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-[#e8f0fe] text-base font-bold text-[#1a73e8]">
                G
              </span>
              <div className="flex-1">
                <p className="text-lg font-semibold text-[var(--color-ink)]">
                  Google Calendar
                </p>
                <p className="text-sm text-[var(--color-ink-soft)]">
                  Assignment dates push to the calendars you choose — updates and
                  cancellations sync automatically.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-epc)_14%,var(--color-bg))] px-2.5 py-0.5 font-medium text-[var(--color-epc)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-epc)]" />
                    Connected as jordan@asbestexperts.be
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                Disconnect
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calendars to write to</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                We&apos;ll create events on the calendars you pick. Turning one off
                won&apos;t delete past events.
              </p>
            </CardHeader>
            <CardBody>
              <ul className="divide-y divide-[var(--color-border)]">
                {calendars.map((c) => (
                  <li key={c.name} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={c.name}
                        defaultChecked={c.selected}
                        className="h-4 w-4 rounded border-[var(--color-border-strong)] accent-[var(--color-brand)]"
                      />
                      <label htmlFor={c.name} className="text-sm text-[var(--color-ink)]">
                        {c.name}
                      </label>
                      {c.primary && (
                        <span className="rounded-full bg-[var(--color-bg-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-muted)]">
                          Primary
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event details</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-sm">
              <ToggleRow
                label="Include property address in event title"
                description="e.g. 'EPC · Meir 34, Antwerpen' vs just 'EPC'."
                defaultChecked
              />
              <ToggleRow
                label="Add freelancer as attendee"
                description="The assigned freelancer gets an invite email from Google."
                defaultChecked
              />
              <ToggleRow
                label="Add owner as attendee"
                description="The property owner receives the calendar invite."
              />
              <ToggleRow
                label="Include assignment form as attachment"
                description="PDF opdrachtformulier is attached to the event."
                defaultChecked
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event notifications</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <IconCheck size={14} className="text-[var(--color-epc)]" />
                <span>1 day before the inspection — email reminder</span>
              </div>
              <div className="flex items-center gap-3">
                <IconCheck size={14} className="text-[var(--color-epc)]" />
                <span>1 hour before the inspection — push reminder</span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function ToggleRow({
  label,
  description,
  defaultChecked,
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0">
      <div>
        <p className="font-medium text-[var(--color-ink)]">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{description}</p>
      </div>
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-[var(--color-border-strong)] accent-[var(--color-brand)]"
      />
    </label>
  );
}
