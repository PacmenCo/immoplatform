import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  IconCheck,
  IconBell,
  IconCalendar,
  IconMegaphone,
  IconUsers,
  IconMail,
  IconArrowRight,
} from "@/components/ui/Icons";

type Notif = {
  id: string;
  icon: "bell" | "calendar" | "megaphone" | "users" | "mail" | "check";
  message: string;
  detail?: string;
  time: string;
  accent: string;
};

const UNREAD: Notif[] = [
  { id: "n1", icon: "calendar", message: "Assignment ASG-2026-1001 scheduled for Apr 25", detail: "Tim De Vos has confirmed the slot at Meir 34, Antwerpen.", time: "12 min ago", accent: "var(--color-fuel)" },
  { id: "n2", icon: "check", message: "Report delivered for ASG-2026-1003", detail: "Certificate PDF generated and sent to Hannah Peeters.", time: "1 hr ago", accent: "var(--color-epc)" },
  { id: "n3", icon: "users", message: "New team invitation", detail: "Pierre Dubois invited lucas@immobruxelles.be to Immo Bruxelles.", time: "3 hr ago", accent: "var(--color-brand)" },
  { id: "n4", icon: "megaphone", message: "Announcement published", detail: "New electrical inspection service now live.", time: "yesterday", accent: "var(--color-electrical)" },
];

const READ: Notif[] = [
  { id: "n5", icon: "mail", message: "Invoice March 2026 sent", detail: "Batch of 47 invoices successfully dispatched.", time: "2 days ago", accent: "var(--color-ink-soft)" },
  { id: "n6", icon: "bell", message: "Your password was changed", detail: "From IP 91.183.24.12 on a MacBook Pro.", time: "3 days ago", accent: "var(--color-asbestos)" },
  { id: "n7", icon: "calendar", message: "Assignment ASG-2026-0998 completed", time: "4 days ago", accent: "var(--color-epc)" },
  { id: "n8", icon: "users", message: "Marie Lefevre joined as staff", time: "5 days ago", accent: "var(--color-brand)" },
  { id: "n9", icon: "megaphone", message: "Platform maintenance completed", detail: "Downtime 02:00 to 04:00 on April 12.", time: "1 week ago", accent: "var(--color-fuel)" },
  { id: "n10", icon: "check", message: "All March payouts processed", time: "1 week ago", accent: "var(--color-epc)" },
];

function NotifIcon({ name, accent }: { name: Notif["icon"]; accent: string }) {
  const map = { bell: IconBell, calendar: IconCalendar, megaphone: IconMegaphone, users: IconUsers, mail: IconMail, check: IconCheck };
  const I = map[name];
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-md"
      style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, var(--color-bg))`, color: accent }}
    >
      <I size={18} />
    </span>
  );
}

function Item({ n, unread }: { n: Notif; unread?: boolean }) {
  return (
    <li className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex items-start gap-3 sm:contents">
        <NotifIcon name={n.icon} accent={n.accent} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {unread && <span className="h-2 w-2 rounded-full bg-[var(--color-asbestos)]" aria-label="unread" />}
            <p className={unread ? "font-semibold text-[var(--color-ink)]" : "text-[var(--color-ink-soft)]"}>{n.message}</p>
          </div>
          {n.detail && <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{n.detail}</p>}
          <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{n.time}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        {unread && (
          <Button variant="ghost" size="sm"><IconCheck size={14} />Mark read</Button>
        )}
        <Button variant="ghost" size="sm">Open <IconArrowRight size={14} /></Button>
      </div>
    </li>
  );
}

export const metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <>
      <Topbar title="Notifications" subtitle={`${UNREAD.length} unread · ${READ.length} read`} />

      <div className="p-4 sm:p-8 max-w-[1000px] space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--color-ink-muted)]">Events on assignments, teams and announcements you follow.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm">Notification settings</Button>
            <Button size="sm"><IconCheck size={14} />Mark all as read</Button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Unread</CardTitle>
              <Badge bg="#fee2e2" fg="#b91c1c">{UNREAD.length}</Badge>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-[var(--color-border)]">
              {UNREAD.map((n) => <Item key={n.id} n={n} unread />)}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Earlier</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-[var(--color-border)]">
              {READ.map((n) => <Item key={n.id} n={n} />)}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
