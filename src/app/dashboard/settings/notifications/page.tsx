import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconMail, IconBell2 } from "@/components/ui/Icons";
import { NOTIFICATION_PREFS } from "@/lib/mockData";
import { SettingsNav } from "../_nav";

const GROUP_LABEL: Record<string, { title: string; description: string; color: string }> = {
  assignment: {
    title: "Assignments",
    description: "Events related to your inspection assignments.",
    color: "var(--color-epc)",
  },
  team: {
    title: "Team",
    description: "Team membership, roles and colleagues.",
    color: "var(--color-fuel)",
  },
  billing: {
    title: "Billing & payouts",
    description: "Invoices, commission balance, payouts.",
    color: "var(--color-accent)",
  },
  platform: {
    title: "Platform",
    description: "Product updates, security, announcements.",
    color: "var(--color-asbestos)",
  },
};

export default function NotificationsSettingsPage() {
  const groups: Record<string, typeof NOTIFICATION_PREFS> = {};
  for (const p of NOTIFICATION_PREFS) {
    (groups[p.group] ||= []).push(p);
  }

  return (
    <>
      <Topbar title="Notifications" subtitle="Control what lands in your inbox" />

      <div className="p-8 max-w-[1000px]">
        <SettingsNav />

        <div className="mt-6 mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold text-[var(--color-ink)]">
              Notification preferences
            </h2>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Pick what you want to hear about via email and as in-app notifications.
              Security alerts are always on.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              Mute all for 1 hour
            </Button>
            <Button variant="ghost" size="sm">
              Restore defaults
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(groups).map(([groupKey, prefs]) => {
            const meta = GROUP_LABEL[groupKey];
            return (
              <Card key={groupKey}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <CardTitle>{meta.title}</CardTitle>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                    {meta.description}
                  </p>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="hidden items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] px-6 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)] sm:flex">
                    <span className="flex-1">Event</span>
                    <span className="flex w-24 items-center justify-center gap-1">
                      <IconMail size={12} />
                      Email
                    </span>
                    <span className="flex w-24 items-center justify-center gap-1">
                      <IconBell2 size={12} />
                      In-app
                    </span>
                  </div>
                  <ul className="divide-y divide-[var(--color-border)]">
                    {prefs.map((p) => (
                      <li
                        key={p.key}
                        className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--color-ink)]">
                            {p.label}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                            {p.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-0">
                          <label className="flex w-24 items-center justify-center gap-2 text-xs sm:gap-0">
                            <span className="sm:hidden">Email</span>
                            <Toggle
                              defaultChecked={p.defaultEmail}
                              name={`${p.key}_email`}
                              ariaLabel={`Email — ${p.label}`}
                            />
                          </label>
                          <label className="flex w-24 items-center justify-center gap-2 text-xs sm:gap-0">
                            <span className="sm:hidden">In-app</span>
                            <Toggle
                              defaultChecked={p.defaultApp}
                              name={`${p.key}_app`}
                              ariaLabel={`In-app — ${p.label}`}
                            />
                          </label>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            );
          })}
        </div>

        <div className="sticky bottom-0 -mx-8 mt-6 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 px-8 py-4 backdrop-blur">
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="md">
              Cancel
            </Button>
            <Button size="md">Save preferences</Button>
          </div>
        </div>
      </div>
    </>
  );
}

function Toggle({
  defaultChecked,
  name,
  ariaLabel,
}: {
  defaultChecked?: boolean;
  name: string;
  ariaLabel?: string;
}) {
  return (
    <span className="relative inline-flex">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        role="switch"
        aria-label={ariaLabel}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="h-5 w-9 cursor-pointer rounded-full bg-[var(--color-border-strong)] transition-colors peer-checked:bg-[var(--color-brand)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] peer-focus-visible:ring-offset-2"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[var(--color-bg)] shadow-sm transition-transform peer-checked:translate-x-4"
      />
    </span>
  );
}
