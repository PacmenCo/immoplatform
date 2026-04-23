import { NextResponse } from "next/server";
import { audit } from "@/lib/auth";
import { monthlyInvoiceReminderEmail, sendEmail } from "@/lib/email";
import { overviewUrl } from "@/lib/urls";

/**
 * Monthly "don't forget to generate invoices" prompt — Platform parity of
 * the MonthlyInvoiceReminder mailable. Fires on day (end-of-month − 3) at
 * whatever hour the external scheduler pings this route; noop on other
 * days so the scheduler can be set to daily without over-firing.
 *
 * Authorisation: Bearer `CRON_SECRET`. Vercel Crons also pass this header
 * when the dashboard's Cron Jobs UI is used, so the same guard works for
 * both self-hosted (node-cron) and Vercel-hosted deployments.
 *
 * Recipient: `INVOICE_REMINDER_EMAIL` (the platform's billing contact).
 * Mirrors v1's single-CONTACT_EMAIL shape; fan-out to all admins is a
 * later improvement when email prefs have per-user invoice-reminder keys.
 *
 * Query param `?force=1` bypasses the date check (for manual triggering
 * + testing). Force-triggered runs still require the Bearer header.
 */

export const dynamic = "force-dynamic";

const REMINDER_LEAD_DAYS = 3;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const recipient = process.env.INVOICE_REMINDER_EMAIL;
  if (!recipient) {
    return NextResponse.json(
      { error: "INVOICE_REMINDER_EMAIL is not configured." },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const now = new Date();
  const target = endOfMonthMinusDays(now, REMINDER_LEAD_DAYS);
  const shouldFire = force || isSameUtcDay(now, target);

  if (!shouldFire) {
    await audit({
      verb: "invoice_reminder.skipped",
      metadata: { reason: "not-due", today: now.toISOString().slice(0, 10) },
    });
    return NextResponse.json({ ok: true, fired: false, nextFireOn: target.toISOString() });
  }

  const monthLabel = formatMonthLabel(now);
  const tpl = monthlyInvoiceReminderEmail({ monthLabel, overviewUrl: overviewUrl() });
  await sendEmail({ to: recipient, ...tpl });

  await audit({
    verb: "invoice_reminder.sent",
    metadata: {
      recipient,
      monthLabel,
      forced: force,
    },
  });

  return NextResponse.json({ ok: true, fired: true, monthLabel });
}

/** UTC end-of-month minus N days, truncated to midnight. */
function endOfMonthMinusDays(now: Date, days: number): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  // Day 0 of the following month = last day of this month.
  const endOfMonth = new Date(Date.UTC(y, m + 1, 0));
  endOfMonth.setUTCDate(endOfMonth.getUTCDate() - days);
  endOfMonth.setUTCHours(0, 0, 0, 0);
  return endOfMonth;
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function formatMonthLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
