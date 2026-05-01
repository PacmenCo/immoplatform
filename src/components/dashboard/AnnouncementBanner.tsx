import { getTranslations } from "next-intl/server";
import { AnnouncementDismissButton } from "./AnnouncementDismissButton";
import type { ActiveAnnouncement, AnnouncementType } from "@/lib/announcementTypes";

/**
 * Presentational banner stack for dashboard home. The caller loads the rows
 * (see `loadActiveAnnouncements`) so the query can run alongside the page's
 * other dashboard queries in a single Promise.all.
 */

const TONE_STYLES: Record<AnnouncementType, string> = {
  info: "border-[var(--color-brand)]/30 bg-[var(--color-brand)]/5 text-[var(--color-ink)]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100",
  danger: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100",
};

export async function AnnouncementBanner({ items }: { items: ActiveAnnouncement[] }) {
  if (items.length === 0) return null;
  const t = await getTranslations("dashboard.shared.announcementBanner");

  return (
    <section aria-label={t("ariaLabel")} className="space-y-3">
      {items.map((a) => {
        const tone = TONE_STYLES[a.type] ? a.type : "info";
        return (
          <div
            key={a.id}
            role="status"
            className={`flex items-start gap-3 rounded-md border px-4 py-3 ${TONE_STYLES[tone]}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="mt-0.5 whitespace-pre-line text-sm opacity-90">{a.body}</p>
            </div>
            {a.isDismissible && <AnnouncementDismissButton announcementId={a.id} />}
          </div>
        );
      })}
    </section>
  );
}
