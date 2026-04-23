import "server-only";
import { prisma } from "@/lib/db";
import { AnnouncementDismissButton } from "./AnnouncementDismissButton";

/**
 * Renders the active announcements for the signed-in user at the top of the
 * dashboard home. Active = isActive AND now between startsAt and endsAt AND
 * not already dismissed by this user.
 */

type Tone = "info" | "success" | "warning" | "danger";

const TONE_STYLES: Record<Tone, string> = {
  info: "border-[var(--color-brand)]/30 bg-[var(--color-brand)]/5 text-[var(--color-ink)]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100",
  danger: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100",
};

export async function AnnouncementBanner({ userId }: { userId: string }) {
  const now = new Date();
  const items = await prisma.announcement.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      dismissals: { none: { userId } },
    },
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      title: true,
      body: true,
      type: true,
      isDismissible: true,
    },
  });

  if (items.length === 0) return null;

  return (
    <section aria-label="Announcements" className="space-y-3">
      {items.map((a) => {
        const tone: Tone = (["info", "success", "warning", "danger"] as const).includes(
          a.type as Tone,
        )
          ? (a.type as Tone)
          : "info";
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
            {a.isDismissible && (
              <AnnouncementDismissButton announcementId={a.id} />
            )}
          </div>
        );
      })}
    </section>
  );
}
