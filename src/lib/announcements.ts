import "server-only";
import { prisma } from "@/lib/db";
import type { ActiveAnnouncement, AnnouncementType } from "@/lib/announcementTypes";

/**
 * Load the active, in-window, not-yet-dismissed announcements for a user.
 * Kept as a plain helper so the caller can parallelize it with the page's
 * other data queries inside a single Promise.all.
 */
export async function loadActiveAnnouncements(
  userId: string,
): Promise<ActiveAnnouncement[]> {
  const now = new Date();
  const rows = await prisma.announcement.findMany({
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
  return rows.map((r) => ({ ...r, type: r.type as AnnouncementType }));
}
