import { Topbar } from "@/components/dashboard/Topbar";
import { requireSession } from "@/lib/auth";
import {
  EMAIL_EVENTS,
  eventsForRole,
  shouldSendEmail,
  type EmailEventKey,
} from "@/lib/email-events";
import { role as roleOf } from "@/lib/permissions";
import { SettingsNav } from "../_nav";
import { NotificationsForm, type PrefRow } from "./NotificationsForm";

export default async function NotificationsSettingsPage() {
  const session = await requireSession();
  const myRole = roleOf(session);
  const user = { emailPrefs: session.user.emailPrefs };

  const eventKeys = eventsForRole(myRole);
  const rows: PrefRow[] = eventKeys.map((key: EmailEventKey) => ({
    key,
    label: EMAIL_EVENTS[key].label,
    description: EMAIL_EVENTS[key].description,
    enabled: shouldSendEmail(user, key),
  }));

  return (
    <>
      <Topbar title="Notifications" subtitle="Control what lands in your inbox" />

      <div className="p-8 max-w-[1000px]">
        <SettingsNav />

        <div className="mt-6 mb-6 max-w-2xl">
          <h2 className="text-xl font-semibold text-[var(--color-ink)]">
            Notification preferences
          </h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Pick which assignment events send you email. Only events relevant to
            your role ({myRole}) appear here.
          </p>
        </div>

        <NotificationsForm rows={rows} />
      </div>
    </>
  );
}
