import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assignmentScope, composeWhere } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Events-by-range endpoint for the calendar UI.
 *
 *   GET /api/calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Scope-respecting (reuses `assignmentScope(session)`). Returns all assignments
 * whose calendarDate (fallback: preferredDate) falls inside the inclusive
 * [start, end] range — matches Platform's `whereBetween(actual_date, ...)`
 * semantics in OverviewList.
 *
 * Session-auth (cookie). Range capped at 90 days to prevent unbounded scans.
 *
 * Response:
 *   { events: [{ id, reference, address, city, postal, status,
 *                preferredDate, calendarDate, teamId, freelancerId }] }
 *
 * Errors:
 *   401 UNAUTHENTICATED — no cookie session
 *   400 BAD_REQUEST     — missing / malformed params, or range > 90 days,
 *                         or start > end
 */
const MAX_RANGE_DAYS = 90;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");

  if (!startParam || !endParam) {
    return NextResponse.json(
      { error: "start and end query params are required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }
  if (!DATE_RE.test(startParam) || !DATE_RE.test(endParam)) {
    return NextResponse.json(
      { error: "start and end must be YYYY-MM-DD" },
      { status: 400 },
    );
  }

  // Parse as UTC midnight — calendar navigation is day-granular, so we don't
  // want server-local TZ to shift the window by ±1 day.
  const start = new Date(`${startParam}T00:00:00.000Z`);
  const end = new Date(`${endParam}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  if (start > end) {
    return NextResponse.json(
      { error: "start must be <= end" },
      { status: 400 },
    );
  }
  const spanDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  if (spanDays > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { error: `range exceeds ${MAX_RANGE_DAYS} days` },
      { status: 400 },
    );
  }

  const scope = await assignmentScope(session);
  // calendarDate is the internal override; preferredDate is the customer-visible
  // ask. Match either falling into the window — mirrors the ladder used by
  // payload.ts + assignments.ts (calendarDate ?? preferredDate).
  const rangeWhere = {
    OR: [
      { calendarDate: { gte: start, lte: end } },
      {
        AND: [
          { calendarDate: null },
          { preferredDate: { gte: start, lte: end } },
        ],
      },
    ],
  };
  const where = composeWhere(scope, rangeWhere);

  const rows = await prisma.assignment.findMany({
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
    },
    orderBy: [{ calendarDate: "asc" }, { preferredDate: "asc" }],
  });

  return NextResponse.json({
    events: rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      address: r.address,
      city: r.city,
      postal: r.postal,
      status: r.status,
      preferredDate: r.preferredDate?.toISOString() ?? null,
      calendarDate: r.calendarDate?.toISOString() ?? null,
      teamId: r.teamId,
      freelancerId: r.freelancerId,
    })),
  });
}
