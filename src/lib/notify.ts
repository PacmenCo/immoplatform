import "server-only";
import { sendEmail } from "./email";
import { shouldSendEmail, type EmailEventKey } from "./email-events";

/**
 * Best-effort lifecycle notification. Checks the recipient's opt-out
 * preference, sends via the configured provider, and swallows delivery
 * failures (logged to `console.error`) so a flaky mailer never breaks
 * an assignment mutation.
 *
 * Use `sendEmail()` directly for transactional mail (invites, resets)
 * where staff need to see delivery failures surface to the caller.
 */
export async function notify(opts: {
  to: { email: string; emailPrefs: string | null };
  event: EmailEventKey;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  if (!shouldSendEmail(opts.to, opts.event)) return;
  try {
    await sendEmail({
      to: opts.to.email,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
  } catch (err) {
    console.error(`[notify] ${opts.event} → ${opts.to.email} failed:`, err);
  }
}
