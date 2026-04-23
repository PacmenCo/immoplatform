/**
 * Announcement tone enum — shared between the server action (zod validation)
 * and the dashboard banner (tone-colored rendering) so the set can't drift.
 * Lives in lib/ so client components can import the type without pulling in
 * the "use server" file.
 */
export const ANNOUNCEMENT_TYPES = ["info", "success", "warning", "danger"] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

/**
 * Shape returned by `loadActiveAnnouncements` and consumed by the banner.
 * `type` is narrowed to `AnnouncementType` at the loader boundary — SQLite
 * stores it as a plain string, but zod validation at write time guarantees
 * the enum membership for every inserted row.
 */
export type ActiveAnnouncement = {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  isDismissible: boolean;
};
