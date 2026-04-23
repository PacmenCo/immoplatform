import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { authorizeBearerToken } from "@/lib/cron-auth";
import { monthlyInvoiceReminderEmail, sendEmail } from "@/lib/email";
import { EN_MONTH_YEAR } from "@/lib/format";
import { endOfMonthMinusDays, isSameUtcDay } from "@/lib/period";
import { overviewUrl } from "@/lib/urls";

/**
 * Monthly "don't forget to generate invoices" prompt — Platform parity of
 * the MonthlyInvoiceReminder mailable. Fires on (end-of-month − 3) UTC;
 * noop on other days so the scheduler can be set to daily without over-firing.
 *
 * Idempotent: if a `invoice_reminder.sent` audit entry already exists for the
 * current UTC day, the route returns without resending. Protects against
 * scheduler retries on transient failures.
 *
 * Authorisation: `Bearer CRON_SECRET`. Vercel Crons sets this header when
 * the dashboard's Cron Jobs UI is used, so the same guard works for
 * both self-hosted (node-cron) and Vercel-hosted deployments.
 *
 * Recipient: `INVOICE_REMINDER_EMAIL` — single address, matching v1's
 * CONTACT_EMAIL shape. Fan-out to admins with per-user opt-out is a later
 * pass when notification preferences gain an invoice-reminder key.
 *
 * `?force=1` bypasses both the date gate and the idempotency guard for
 * manual testing. Still requires the Bearer header.
 */

export const dynamic = "force-dynamic";

const REMINDER_LEAD_DAYS = 3;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  if (!authorizeBearerToken(req, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const recipient = process.env.INVOICE_REMINDER_EMAIL;
  if (!recipient) {
    return NextResponse.json(
      { error: "INVOICE_REMINDER_EMAIL is not configured." },
      { status: 500 },
    );
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  const now = new Date();
  const target = endOfMonthMinusDays(now, REMINDER_LEAD_DAYS);

  if (!force && !isSameUtcDay(now, target)) {
    await audit({
      verb: "invoice_reminder.skipped",
      metadata: { reason: "not-due", today: now.toISOString().slice(0, 10) },
    });
    return NextResponse.json({ ok: true, fired: false, nextFireOn: target.toISOString() });
  }

  if (!force && (await alreadySentToday(now))) {
    await audit({
      verb: "invoice_reminder.skipped",
      metadata: { reason: "already-sent-today", today: now.toISOString().slice(0, 10) },
    });
    return NextResponse.json({ ok: true, fired: false, reason: "already-sent-today" });
  }

  const monthLabel = EN_MONTH_YEAR.format(now);
  const tpl = monthlyInvoiceReminderEmail({ monthLabel, overviewUrl: overviewUrl() });
  await sendEmail({ to: recipient, ...tpl });

  await audit({
    verb: "invoice_reminder.sent",
    metadata: { recipient, monthLabel, forced: force },
  });

  return NextResponse.json({ ok: true, fired: true, monthLabel });
}

async function alreadySentToday(now: Date): Promise<boolean> {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const hit = await prisma.auditLog.findFirst({
    where: { verb: "invoice_reminder.sent", at: { gte: startOfDay } },
    select: { id: true },
  });
  return hit !== null;
}
