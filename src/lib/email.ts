/**
 * Email transport dispatcher.
 *
 * Dev default (EMAIL_PROVIDER unset or "dev"): logs to the server console.
 * Prod: set EMAIL_PROVIDER=resend + RESEND_API_KEY + EMAIL_FROM.
 *
 * Template helpers (`inviteEmail`, `passwordResetEmail`, `addedToTeamEmail`)
 * return `{ subject, text }`; the transport is body-type-agnostic so we
 * can add HTML variants without touching the interface.
 *
 * Caller contract: `sendEmail` throws on delivery failure. Callers decide
 * whether to surface the error to the user or swallow it — `forgotPassword`
 * intentionally swallows to avoid email enumeration, while `createInvite`
 * currently propagates so staff see when delivery is broken.
 */

import "server-only";

type SendEmailArgs = {
  to: string;
  subject: string;
  html?: string;
  text: string;
};

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const provider = (process.env.EMAIL_PROVIDER ?? "dev").toLowerCase();
  if (provider === "dev") {
    logToConsole(args);
    return;
  }
  if (provider === "resend") {
    return sendViaResend(args);
  }
  throw new Error(
    `Unknown EMAIL_PROVIDER "${provider}". Supported: "dev" (default) or "resend".`,
  );
}

function logToConsole(args: SendEmailArgs): void {
  console.log("\n📧 [dev email] ──────────────────────────────");
  console.log(`To:      ${args.to}`);
  console.log(`Subject: ${args.subject}`);
  console.log("──────");
  console.log(args.text);
  console.log("─────────────────────────────────────────────\n");
}

async function sendViaResend(args: SendEmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  if (!from) {
    throw new Error(
      'EMAIL_FROM is not set. Use e.g. "Immo <no-reply@yourdomain.com>".',
    );
  }

  const body: Record<string, unknown> = {
    from,
    to: [args.to],
    subject: args.subject,
    text: args.text,
  };
  if (args.html) body.html = args.html;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    // Hard cap so a Resend slowdown can't stall a user's server action for
    // the full Node/Vercel request budget. notify() swallows the AbortError.
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Resend rejected the email: ${res.status} ${res.statusText} ${errText}`.trim(),
    );
  }
}

// ─── Templates ─────────────────────────────────────────────────────

export function inviteEmail(opts: {
  inviterName: string;
  acceptUrl: string;
  role: string;
  teamName?: string | null;
  teamRole?: string | null;
  note?: string | null;
  expiresAt: Date;
}): { subject: string; text: string } {
  const teamLine = opts.teamName
    ? `\nTeam: ${opts.teamName} (${opts.teamRole})`
    : "";
  const noteLine = opts.note ? `\nNote from ${opts.inviterName}: "${opts.note}"` : "";
  return {
    subject: `You're invited to join Immo as a ${opts.role}`,
    text: `${opts.inviterName} invited you to Immo.

Role: ${opts.role}${teamLine}${noteLine}

Accept your invite and set a password:
${opts.acceptUrl}

This link expires on ${opts.expiresAt.toISOString().slice(0, 10)}.`,
  };
}

export function passwordResetEmail(opts: {
  name: string;
  resetUrl: string;
}): { subject: string; text: string } {
  return {
    subject: "Reset your Immo password",
    text: `Hi ${opts.name},

Someone requested a password reset for your Immo account. If this was you, open the link below to choose a new password. The link expires in 1 hour.

${opts.resetUrl}

If you didn't request this, you can safely ignore this email.`,
  };
}

export function addedToTeamEmail(opts: {
  inviterName: string;
  teamName: string;
  teamRole: string;
  loginUrl: string;
}): { subject: string; text: string } {
  return {
    subject: `You've been added to ${opts.teamName} on Immo`,
    text: `${opts.inviterName} added you to the team "${opts.teamName}" on Immo as a ${opts.teamRole}.

Sign in to see the team's assignments:
${opts.loginUrl}`,
  };
}

// ─── Assignment lifecycle templates ────────────────────────────────

type AssignmentCtx = {
  reference: string;
  address: string;
  city: string;
  postal: string;
  assignmentUrl: string;
};

function addressLine(a: AssignmentCtx): string {
  return `${a.address}, ${a.postal} ${a.city}`;
}

export function assignmentDateUpdatedEmail(opts: AssignmentCtx & {
  recipientName: string;
  previousDate: Date | null;
  newDate: Date | null;
}): { subject: string; text: string } {
  const prev = opts.previousDate?.toISOString().slice(0, 10) ?? "unscheduled";
  const next = opts.newDate?.toISOString().slice(0, 10) ?? "unscheduled";
  return {
    subject: `Date changed: ${addressLine(opts)} (${opts.reference})`,
    text: `Hi ${opts.recipientName},

The preferred date for ${opts.reference} (${addressLine(opts)}) has changed.

Previous: ${prev}
New:      ${next}

${opts.assignmentUrl}`,
  };
}

export function assignmentDeliveredEmail(opts: AssignmentCtx & {
  recipientName: string;
  /** The person who flipped the status. May be the freelancer or an admin acting on their behalf. */
  actorName: string;
  /** The assigned freelancer's name, if any — rendered when actor ≠ freelancer so recipients know whose work was delivered. */
  freelancerName: string | null;
}): { subject: string; text: string } {
  const byLine =
    opts.freelancerName && opts.freelancerName !== opts.actorName
      ? `${opts.actorName} marked ${opts.freelancerName}'s inspection`
      : `${opts.actorName} marked the inspection`;
  return {
    subject: `Delivered: ${addressLine(opts)} (${opts.reference})`,
    text: `Hi ${opts.recipientName},

${byLine} at ${addressLine(opts)} (${opts.reference}) as delivered. Review the files and sign off when you're ready.

${opts.assignmentUrl}`,
  };
}

export function assignmentCompletedEmail(opts: AssignmentCtx & {
  recipientName: string;
  completedByName: string;
}): { subject: string; text: string } {
  return {
    subject: `Completed: ${addressLine(opts)} (${opts.reference})`,
    text: `Hi ${opts.recipientName},

${opts.completedByName} signed off on ${opts.reference} (${addressLine(opts)}). It's now closed and moves out of the active queue.

${opts.assignmentUrl}`,
  };
}

export function assignmentCancelledEmail(opts: AssignmentCtx & {
  recipientName: string;
  cancelledByName: string;
  reason: string | null;
}): { subject: string; text: string } {
  const reasonLine = opts.reason ? `\nReason: ${opts.reason}\n` : "";
  return {
    subject: `Cancelled: ${addressLine(opts)} (${opts.reference})`,
    text: `Hi ${opts.recipientName},

${opts.cancelledByName} cancelled ${opts.reference} (${addressLine(opts)}).
${reasonLine}
${opts.assignmentUrl}`,
  };
}

export function assignmentReassignedEmail(opts: AssignmentCtx & {
  freelancerName: string;
  preferredDate: Date | null;
}): { subject: string; text: string } {
  const dateLine = opts.preferredDate
    ? `Preferred date: ${opts.preferredDate.toISOString().slice(0, 10)}\n`
    : "";
  return {
    subject: `New inspection: ${addressLine(opts)} (${opts.reference})`,
    text: `Hi ${opts.freelancerName},

You've been assigned to ${opts.reference} (${addressLine(opts)}).
${dateLine}
${opts.assignmentUrl}`,
  };
}

export function filesUploadedEmail(opts: AssignmentCtx & {
  recipientName: string;
  uploaderName: string;
  lane: "freelancer" | "realtor";
  fileCount: number;
}): { subject: string; text: string } {
  const what =
    opts.lane === "freelancer"
      ? `delivered ${opts.fileCount} file${opts.fileCount === 1 ? "" : "s"}`
      : `uploaded ${opts.fileCount} supporting file${opts.fileCount === 1 ? "" : "s"}`;
  return {
    subject: `New files: ${addressLine(opts)} (${opts.reference})`,
    text: `Hi ${opts.recipientName},

${opts.uploaderName} ${what} on ${opts.reference} (${addressLine(opts)}).

View the files:
${opts.assignmentUrl}/files`,
  };
}

export function commentPostedEmail(opts: AssignmentCtx & {
  recipientName: string;
  authorName: string;
  body: string;
}): { subject: string; text: string } {
  // Grapheme-aware truncate — `.slice` splits surrogate pairs and emoji ZWJs
  // which Gmail renders as replacement characters. Array.from works because
  // the iterator yields code points grouped for surrogate pairs.
  const chars = Array.from(opts.body);
  const preview = chars.length > 200 ? chars.slice(0, 200).join("") + "…" : opts.body;
  return {
    subject: `New comment: ${addressLine(opts)} (${opts.reference})`,
    text: `Hi ${opts.recipientName},

${opts.authorName} commented on ${opts.reference} (${addressLine(opts)}):

"${preview}"

Reply on the thread:
${opts.assignmentUrl}`,
  };
}
