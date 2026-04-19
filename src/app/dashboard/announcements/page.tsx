import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconPlus, IconMegaphone } from "@/components/ui/Icons";
import { Badge } from "@/components/ui/Badge";

const announcements = [
  {
    id: "an_1",
    title: "Easter maintenance window — Apr 20",
    body: "The platform will be offline between 02:00 and 04:00 for routine database maintenance.",
    type: "info" as const,
    startsAt: "2026-04-18",
    endsAt: "2026-04-21",
    active: true,
  },
  {
    id: "an_2",
    title: "New electrical inspection service now live",
    body: "You can now request AREI-compliant electrical inspections on any assignment.",
    type: "success" as const,
    startsAt: "2026-04-10",
    endsAt: "2026-04-30",
    active: true,
  },
  {
    id: "an_3",
    title: "Commission payout delayed — March 2026",
    body: "Payouts for March will be processed April 22 due to the bank holiday.",
    type: "warning" as const,
    startsAt: "2026-04-05",
    endsAt: "2026-04-22",
    active: false,
  },
];

const typeStyles: Record<string, { bg: string; fg: string; label: string }> = {
  info: { bg: "#eff6ff", fg: "#1d4ed8", label: "Info" },
  success: { bg: "#ecfdf5", fg: "#047857", label: "Success" },
  warning: { bg: "#fef3c7", fg: "#b45309", label: "Warning" },
};

export default function AnnouncementsPage() {
  return (
    <>
      <Topbar title="Announcements" subtitle="Banner messages shown to users" />

      <div className="p-8 max-w-[1000px] space-y-6">
        <div className="flex items-center justify-end">
          <Button size="sm">
            <IconPlus size={14} />
            New announcement
          </Button>
        </div>

        <div className="space-y-4">
          {announcements.map((a) => {
            const t = typeStyles[a.type];
            return (
              <Card key={a.id} className="overflow-hidden">
                <div className="flex items-start gap-4 p-6">
                  <span
                    className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-md"
                    style={{ backgroundColor: t.bg, color: t.fg }}
                  >
                    <IconMegaphone size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-[var(--color-ink)]">{a.title}</h3>
                      <Badge bg={t.bg} fg={t.fg}>{t.label}</Badge>
                      {a.active ? (
                        <Badge bg="#dcfce7" fg="#15803d">Active</Badge>
                      ) : (
                        <Badge>Expired</Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{a.body}</p>
                    <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
                      {a.startsAt} → {a.endsAt}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button variant="secondary" size="sm">Edit</Button>
                    <Button variant="ghost" size="sm">Archive</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
