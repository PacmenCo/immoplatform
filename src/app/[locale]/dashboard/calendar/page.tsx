import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assignmentScope, buildCanEditAssignment, composeWhere, gateRealtorRequiresTeam } from "@/lib/permissions";
import { STATUS_META, type Status } from "@/lib/mockData";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const MONTH_KEYS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

type View = "week" | "month";

type SearchParams = Promise<{ view?: string; date?: string }>;

type CalendarAssignment = {
  id: string;
  reference: string;
  address: string;
  city: string;
  postal: string;
  status: string;
  preferredDate: Date | null;
  calendarDate: Date | null;
  teamId: string | null;
  freelancerId: string | null;
  createdById: string | null;
  services: Array<{ serviceKey: string }>;
};

// ─── Date helpers ──────────────────────────────────────────────────
// Day-level math is done against local wall-clock so "April 25" lines up
// with the cell the user sees. Stored values may include time-of-day; for
// grid placement we drop that.

function parseDateParam(raw: string | undefined): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Monday=0 week-start. Matches the Mon-first grid used by the UI. */
function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const delta = (day + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - delta);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** True if a and b fall on the same calendar day (local). */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ─── Page ──────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.pageTitles");
  return { title: t("calendar") };
}

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession();
  await gateRealtorRequiresTeam(session);
  const canEdit = await buildCanEditAssignment(session);
  const params = await searchParams;
  const view: View = params.view === "week" ? "week" : "month";
  const cursor = parseDateParam(params.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const t = await getTranslations("dashboard.calendar");
  const tFilters = await getTranslations("dashboard.calendar.filters");
  const tWeekdays = await getTranslations("dashboard.calendar.weekdays");
  const tMonths = await getTranslations("dashboard.calendar.months");
  const tEvents = await getTranslations("dashboard.calendar.events");
  const weekdayLabels = WEEKDAY_KEYS.map((k) => tWeekdays(k));
  const monthNames = MONTH_KEYS.map((k) => tMonths(k));

  // Compute range window: month = full month (padded to Mon grid),
  // week = 7-day window starting Monday.
  const rangeStart = view === "week" ? startOfWeek(cursor) : startOfMonth(cursor);
  const rangeEnd =
    view === "week" ? addDays(rangeStart, 6) : endOfMonth(cursor);

  // Prisma WHERE uses full-day bounds. Pull assignments whose calendarDate
  // (fallback: preferredDate) falls inside the visible window — scope-respecting.
  const queryStart = new Date(
    rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 0, 0, 0, 0,
  );
  const queryEnd = new Date(
    rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59, 999,
  );
  const scope = await assignmentScope(session);
  const where = composeWhere(scope, {
    OR: [
      { calendarDate: { gte: queryStart, lte: queryEnd } },
      {
        AND: [
          { calendarDate: null },
          { preferredDate: { gte: queryStart, lte: queryEnd } },
        ],
      },
    ],
  });

  const [assignments, services] = await Promise.all([
    prisma.assignment.findMany({
      where,
      select: {
        id: true,
        reference: true,
        address: true,
        city: true,
        postal: true,
        status: true,
        preferredDate: true,
        calendarDate: true,
        teamId: true,
        freelancerId: true,
        createdById: true,
        services: { select: { serviceKey: true } },
      },
      orderBy: [{ calendarDate: "asc" }, { preferredDate: "asc" }],
    }),
    prisma.service.findMany({ select: { key: true, color: true, short: true } }),
  ]);

  const servicesByKey = Object.fromEntries(
    services.map((s) => [s.key, s]),
  ) as Record<string, { key: string; color: string; short: string }>;

  // Bucket by ISO date string for O(1) lookup when rendering cells.
  const byDay = new Map<string, CalendarAssignment[]>();
  for (const a of assignments) {
    const anchor = a.calendarDate ?? a.preferredDate;
    if (!anchor) continue;
    const key = toISODate(anchor);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(a);
    else byDay.set(key, [a]);
  }

  // Navigation — prev/next step depends on view.
  const stepPrev =
    view === "week" ? toISODate(addDays(cursor, -7)) : toISODate(addMonths(cursor, -1));
  const stepNext =
    view === "week" ? toISODate(addDays(cursor, 7)) : toISODate(addMonths(cursor, 1));
  const todayHref = buildHref(view, toISODate(today));

  // Heading — month name for month view, ISO date range for week view.
  const heading =
    view === "week"
      ? `${formatShort(rangeStart, monthNames)} – ${formatShort(rangeEnd, monthNames)}`
      : `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <>
      <Topbar title={t("topbarTitle")} subtitle={heading} />

      <div className="p-8 max-w-[1400px]">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={buildHref(view, stepPrev)}
              aria-label={tFilters("previous")}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-alt)]"
            >
              ‹
            </Link>
            <Link
              href={todayHref}
              className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-alt)]"
            >
              {tFilters("today")}
            </Link>
            <Link
              href={buildHref(view, stepNext)}
              aria-label={tFilters("next")}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-alt)]"
            >
              ›
            </Link>
            <h2 className="ml-4 text-lg font-semibold">{heading}</h2>
          </div>
          <div className="flex gap-2">
            <Link
              href={buildHref("week", toISODate(cursor))}
              aria-current={view === "week" ? "page" : undefined}
              className={
                view === "week"
                  ? "rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-1.5 text-sm font-medium"
                  : "rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-alt)]"
              }
            >
              {tFilters("viewWeek")}
            </Link>
            <Link
              href={buildHref("month", toISODate(cursor))}
              aria-current={view === "month" ? "page" : undefined}
              className={
                view === "month"
                  ? "rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-1.5 text-sm font-medium"
                  : "rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-alt)]"
              }
            >
              {tFilters("viewMonth")}
            </Link>
          </div>
        </div>

        {view === "week" ? (
          <WeekGrid
            rangeStart={rangeStart}
            today={today}
            byDay={byDay}
            servicesByKey={servicesByKey}
            canEdit={canEdit}
            weekdayLabels={weekdayLabels}
            noAssignmentsLabel={tEvents("noAssignments")}
            fallbackShort={tEvents("fallbackShort")}
          />
        ) : (
          <MonthGrid
            cursor={cursor}
            today={today}
            byDay={byDay}
            servicesByKey={servicesByKey}
            canEdit={canEdit}
            weekdayLabels={weekdayLabels}
            fallbackShort={tEvents("fallbackShort")}
          />
        )}
      </div>
    </>
  );
}

function buildHref(view: View, date: string): string {
  const sp = new URLSearchParams();
  if (view === "week") sp.set("view", "week");
  sp.set("date", date);
  return `/dashboard/calendar?${sp.toString()}`;
}

function formatShort(d: Date, monthNames: string[]): string {
  return `${monthNames[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

// ─── Month grid ────────────────────────────────────────────────────

function MonthGrid({
  cursor,
  today,
  byDay,
  servicesByKey,
  canEdit,
  weekdayLabels,
  fallbackShort,
}: {
  cursor: Date;
  today: Date;
  byDay: Map<string, CalendarAssignment[]>;
  servicesByKey: Record<string, { key: string; color: string; short: string }>;
  canEdit: (a: CalendarAssignment) => boolean;
  weekdayLabels: string[];
  fallbackShort: string;
}) {
  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  const leading = (first.getDay() + 6) % 7; // Mon=0
  const days: Array<{ date: Date | null; inMonth: boolean }> = [];
  for (let i = 0; i < leading; i++) days.push({ date: null, inMonth: false });
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d), inMonth: true });
  }
  while (days.length % 7 !== 0) days.push({ date: null, inMonth: false });

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
        {weekdayLabels.map((wd) => (
          <div key={wd} className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            {wd}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const iso = d.date ? toISODate(d.date) : "";
          const events = iso ? byDay.get(iso) ?? [] : [];
          const isToday = d.date ? sameDay(d.date, today) : false;
          return (
            <div
              key={i}
              className="min-h-[110px] border-b border-r border-[var(--color-border)] p-2"
              style={{ backgroundColor: d.inMonth ? "var(--color-bg)" : "var(--color-bg-alt)" }}
            >
              {d.date && (
                <div
                  className={
                    isToday
                      ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand)] text-xs font-semibold text-[var(--color-on-brand)]"
                      : "text-xs font-semibold text-[var(--color-ink-muted)]"
                  }
                >
                  {d.date.getDate()}
                </div>
              )}
              <div className="mt-1 space-y-1">
                {events.map((e) => (
                  <EventChip
                    key={e.id}
                    event={e}
                    servicesByKey={servicesByKey}
                    canEdit={canEdit}
                    fallbackShort={fallbackShort}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Week grid ─────────────────────────────────────────────────────

function WeekGrid({
  rangeStart,
  today,
  byDay,
  servicesByKey,
  canEdit,
  weekdayLabels,
  noAssignmentsLabel,
  fallbackShort,
}: {
  rangeStart: Date;
  today: Date;
  byDay: Map<string, CalendarAssignment[]>;
  servicesByKey: Record<string, { key: string; color: string; short: string }>;
  canEdit: (a: CalendarAssignment) => boolean;
  weekdayLabels: string[];
  noAssignmentsLabel: string;
  fallbackShort: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i));

  return (
    <>
      {/* Mobile: vertical agenda — each day is a stacked block. The 7-column
          grid below is too cramped at < sm to read event titles. */}
      <div className="sm:hidden space-y-3">
        {days.map((d, i) => {
          const iso = toISODate(d);
          const isToday = sameDay(d, today);
          const events = byDay.get(iso) ?? [];
          return (
            <Card key={i} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {weekdayLabels[i]}
                </span>
                <span
                  className={
                    isToday
                      ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand)] text-xs font-semibold text-[var(--color-on-brand)]"
                      : "text-sm font-semibold text-[var(--color-ink-soft)]"
                  }
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="p-2 space-y-1">
                {events.length === 0 ? (
                  <div className="text-[11px] text-[var(--color-ink-faint)] italic px-1 py-1">
                    {noAssignmentsLabel}
                  </div>
                ) : (
                  events.map((e) => (
                    <WeekEventCard
                      key={e.id}
                      event={e}
                      servicesByKey={servicesByKey}
                      canEdit={canEdit}
                      fallbackShort={fallbackShort}
                    />
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Tablet + desktop: classic 7-column week grid. */}
      <Card className="hidden sm:block overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          {days.map((d, i) => {
            const isToday = sameDay(d, today);
            return (
              <div
                key={i}
                className="px-3 py-2 flex items-center justify-between gap-2"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {weekdayLabels[i]}
                </span>
                <span
                  className={
                    isToday
                      ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand)] text-xs font-semibold text-[var(--color-on-brand)]"
                      : "text-sm font-semibold text-[var(--color-ink-soft)]"
                  }
                >
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const iso = toISODate(d);
            const events = byDay.get(iso) ?? [];
            return (
              <div
                key={i}
                className="min-h-[420px] border-b border-r border-[var(--color-border)] p-2 space-y-1"
              >
                {events.length === 0 ? (
                  <div className="text-[11px] text-[var(--color-ink-faint)] italic px-1 pt-1">
                    {noAssignmentsLabel}
                  </div>
                ) : (
                  events.map((e) => (
                    <WeekEventCard
                      key={e.id}
                      event={e}
                      servicesByKey={servicesByKey}
                      canEdit={canEdit}
                      fallbackShort={fallbackShort}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

// ─── Event renderers ───────────────────────────────────────────────

/**
 * Resolves the service-color list for an event. Multi-service assignments
 * (EPC + asbestos, etc.) get one entry per service so the chip can render
 * a colored stripe per service — a single-color chip silently hid the
 * second service in the prior implementation.
 */
function eventColors(
  event: CalendarAssignment,
  servicesByKey: Record<string, { key: string; color: string; short: string }>,
  fallbackShort: string,
): Array<{ color: string; short: string }> {
  const seen: Array<{ color: string; short: string }> = [];
  for (const s of event.services) {
    const svc = servicesByKey[s.serviceKey];
    if (svc && !seen.some((e) => e.color === svc.color)) {
      seen.push({ color: svc.color, short: svc.short });
    }
  }
  if (seen.length === 0) seen.push({ color: "var(--color-ink-muted)", short: fallbackShort });
  return seen;
}

function EventChip({
  event,
  servicesByKey,
  canEdit,
  fallbackShort,
}: {
  event: CalendarAssignment;
  servicesByKey: Record<string, { key: string; color: string; short: string }>;
  canEdit: (a: CalendarAssignment) => boolean;
  fallbackShort: string;
}) {
  const colors = eventColors(event, servicesByKey, fallbackShort);
  const primaryColor = colors[0].color;
  const tooltip = `${event.reference} — ${event.address}, ${event.city} (${colors.map((c) => c.short).join(" + ")})`;
  return (
    <Link
      href={`/dashboard/assignments/${event.id}${canEdit(event) ? "/edit" : ""}`}
      className="relative block truncate rounded px-1.5 py-0.5 pl-2 text-[11px] font-medium hover:underline"
      style={{
        color: primaryColor,
        backgroundColor: `color-mix(in srgb, ${primaryColor} 12%, var(--color-bg))`,
      }}
      title={tooltip}
    >
      <ServiceStripe colors={colors} />
      {event.address}
    </Link>
  );
}

function WeekEventCard({
  event,
  servicesByKey,
  canEdit,
  fallbackShort,
}: {
  event: CalendarAssignment;
  servicesByKey: Record<string, { key: string; color: string; short: string }>;
  canEdit: (a: CalendarAssignment) => boolean;
  fallbackShort: string;
}) {
  const colors = eventColors(event, servicesByKey, fallbackShort);
  const primaryColor = colors[0].color;
  const timeAnchor = event.calendarDate ?? event.preferredDate;
  const time = timeAnchor ? formatTime(timeAnchor) : null;
  const meta = STATUS_META[event.status as Status];
  const allShorts = colors.map((c) => c.short).join(" + ");
  return (
    <Link
      href={`/dashboard/assignments/${event.id}${canEdit(event) ? "/edit" : ""}`}
      className="relative block rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 pl-3 py-1.5 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-alt)]"
      title={`${event.reference} — ${event.address}, ${event.postal} ${event.city} (${allShorts})`}
    >
      <ServiceStripe colors={colors} />
      <div className="flex items-center justify-between gap-2">
        <span
          className="truncate text-[11px] font-semibold"
          style={{ color: primaryColor }}
        >
          {allShorts}
          {time ? ` · ${time}` : ""}
        </span>
        {meta && (
          <span
            className="shrink-0 rounded px-1 py-[1px] text-[9px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: meta.bg, color: meta.fg }}
          >
            {meta.label}
          </span>
        )}
      </div>
      <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--color-ink)]">
        {event.address}
      </p>
      <p className="truncate text-[11px] text-[var(--color-ink-muted)]">
        {event.postal} {event.city}
      </p>
    </Link>
  );
}

/**
 * Left-edge color bar for multi-service events. One contiguous strip with
 * each service taking an equal vertical share. Aria hidden because the
 * tooltip already names every service.
 */
function ServiceStripe({ colors }: { colors: Array<{ color: string; short: string }> }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 flex w-1 flex-col overflow-hidden rounded-l"
    >
      {colors.map((c, i) => (
        <span key={i} className="flex-1" style={{ backgroundColor: c.color }} />
      ))}
    </span>
  );
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
