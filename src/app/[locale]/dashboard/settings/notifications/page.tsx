import { getTranslations } from "next-intl/server";
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
import { SettingsNav } from "../_nav";
import { NotificationsForm, type PrefGroup, type PrefRow } from "./NotificationsForm";
import { SettingsScopeBanner } from "@/components/dashboard/SettingsScopeBanner";

// Map the email-event keys (which live in src/lib and contain dots) to the
// dotless catalog keys under `dashboard.settings.notifications.events.*`.
// next-intl uses dots as path separators in keys, so we can't reuse the
// raw event keys directly in the JSON catalog without ambiguity.
const EVENT_CATALOG_KEY: Record<EmailEventKey, string> = {
  "assignment.created": "assignmentCreated",
  "assignment.scheduled": "assignmentScheduled",
  "assignment.date_updated": "assignmentDateUpdated",
  "assignment.freelancer_assigned": "assignmentFreelancerAssigned",
  "assignment.freelancer_unassigned": "assignmentFreelancerUnassigned",
  "assignment.completed": "assignmentCompleted",
  "assignment.cancelled": "assignmentCancelled",
  "assignment.files_uploaded": "assignmentFilesUploaded",
  "assignment.comment_posted": "assignmentCommentPosted",
  "team.member_added": "teamMemberAdded",
  "user.registered": "userRegistered",
};

function roleCatalogKey(r: Role): "admin" | "staff" | "realtor" | "freelancer" {
  return r;
}

export default async function NotificationsSettingsPage() {
  const session = await requireSession();
  const myRole = roleOf(session);
  const user = { emailPrefs: session.user.emailPrefs };

  const tTopbar = await getTranslations("dashboard.settings.notifications.topbar");
  const tNotif = await getTranslations("dashboard.settings.notifications");
  const tCat = await getTranslations(
    "dashboard.settings.notifications.categories",
  );
  const tEvt = await getTranslations(
    "dashboard.settings.notifications.events",
  );
  const tRoles = await getTranslations(
    "dashboard.settings.notifications.roles",
  );

  const eventKeys = eventsForRole(myRole);

  // Group rows by category. Iterate EMAIL_CATEGORIES so render order matches
  // Platform's (assignments → team → user); skip categories the viewer's
  // role doesn't have any events in.
  const groups: PrefGroup[] = EMAIL_CATEGORIES.map((cat) => {
    const rows: PrefRow[] = eventKeys
      .filter((key: EmailEventKey) => EMAIL_EVENTS[key].category === cat.key)
      .map((key: EmailEventKey) => {
        const ck = EVENT_CATALOG_KEY[key];
        return {
          key,
          label: tEvt(`${ck}.label` as Parameters<typeof tEvt>[0]),
          description: tEvt(`${ck}.description` as Parameters<typeof tEvt>[0]),
          enabled: shouldSendEmail(user, key),
        };
      });
    return {
      key: cat.key as EmailCategoryKey,
      label: tCat(`${cat.key}.label` as Parameters<typeof tCat>[0]),
      description: tCat(`${cat.key}.description` as Parameters<typeof tCat>[0]),
      rows,
    };
  }).filter((g) => g.rows.length > 0);

  return (
    <>
      <Topbar title={tTopbar("title")} subtitle={tTopbar("subtitle")} />

      <div className="p-8 max-w-[1000px]">
        <SettingsNav />

        <div className="mt-6 mb-6">
          <SettingsScopeBanner scope="personal" />
        </div>

        <div className="mb-6 max-w-2xl">
          <h2 className="text-xl font-semibold text-[var(--color-ink)]">
            {tNotif("heading")}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {tNotif("intro", { role: tRoles(roleCatalogKey(myRole)) })}
          </p>
        </div>

        <NotificationsForm groups={groups} />
      </div>
    </>
  );
}
