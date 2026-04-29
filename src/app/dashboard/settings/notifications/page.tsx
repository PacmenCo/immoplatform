import { Topbar } from "@/components/dashboard/Topbar";
import { requireSession } from "@/lib/auth";
import {
  EMAIL_CATEGORIES,
  EMAIL_EVENTS,
  eventsForRole,
  shouldSendEmail,
  type EmailCategoryKey,
  type EmailEventKey,
} from "@/lib/email-events";
import { role as roleOf, type Role } from "@/lib/permissions";
import { roleBadge } from "@/lib/roleColors";
import { SettingsNav } from "../_nav";
import { NotificationsForm, type PrefGroup, type PrefRow } from "./NotificationsForm";
import { SettingsScopeBanner } from "@/components/dashboard/SettingsScopeBanner";

function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function humanRole(r: Role): string {
  const label = roleBadge(r).label;
  return `${articleFor(label)} ${label}`;
}

export default async function NotificationsSettingsPage() {
  const session = await requireSession();
  const myRole = roleOf(session);
  const user = { emailPrefs: session.user.emailPrefs };

  const eventKeys = eventsForRole(myRole);

  // Group rows by category. Iterate EMAIL_CATEGORIES so render order matches
  // Platform's (assignments → team → user); skip categories the viewer's
  // role doesn't have any events in.
  const groups: PrefGroup[] = EMAIL_CATEGORIES.map((cat) => {
    const rows: PrefRow[] = eventKeys
      .filter((key: EmailEventKey) => EMAIL_EVENTS[key].category === cat.key)
      .map((key: EmailEventKey) => ({
        key,
        label: EMAIL_EVENTS[key].label,
        description: EMAIL_EVENTS[key].description,
        enabled: shouldSendEmail(user, key),
      }));
    return {
      key: cat.key as EmailCategoryKey,
      label: cat.label,
      description: cat.description,
      rows,
    };
  }).filter((g) => g.rows.length > 0);

  return (
    <>
      <Topbar title="Notifications" subtitle="Control what lands in your inbox" />

      <div className="p-8 max-w-[1000px]">
        <SettingsNav />

        <div className="mt-6 mb-6">
          <SettingsScopeBanner scope="personal" />
        </div>

        <div className="mb-6 max-w-2xl">
          <h2 className="text-xl font-semibold text-[var(--color-ink)]">
            Notification preferences
          </h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Pick which events send you email. Only events relevant to your role
            as {humanRole(myRole)} appear here.
          </p>
        </div>

        <NotificationsForm groups={groups} />
      </div>
    </>
  );
}
