import "server-only";
import { prisma } from "@/lib/db";
import type { ActiveAnnouncement } from "@/lib/announcementTypes";

/**
 * Load the active, in-window, not-yet-dismissed announcements for a user.
 * Kept as a plain helper so the caller can parallelize it with the page's
 * other data queries inside a single Promise.all.
 */
export async function loadActiveAnnouncements(
  userId: string,
): Promise<ActiveAnnouncement[]> {
  const now = new Date();
  // The `type` column is String in the schema (SQLite has no enum); the
  // write-side zod validator enforces ANNOUNCEMENT_TYPES membership, so
  // asserting the narrower type at the boundary is safe. A row-by-row map
  // would just re-allocate objects to re-label a runtime-identical field.
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
  return rows as ActiveAnnouncement[];
}
