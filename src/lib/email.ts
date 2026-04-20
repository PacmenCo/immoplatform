// Dev email transport — logs to the server console instead of sending.
// When Postmark/Resend is wired up, replace the body of `sendEmail`.

type SendEmailArgs = {
  to: string;
  subject: string;
  html?: string;
  text: string;
};

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  if (process.env.EMAIL_PROVIDER && process.env.EMAIL_PROVIDER !== "dev") {
    throw new Error(
      `Email provider "${process.env.EMAIL_PROVIDER}" is not wired up yet. ` +
        `Leave EMAIL_PROVIDER unset (or "dev") to use the console logger.`,
    );
  }

  console.log("\n📧 [dev email] ──────────────────────────────");
  console.log(`To:      ${args.to}`);
  console.log(`Subject: ${args.subject}`);
  console.log("──────");
  console.log(args.text);
  console.log("─────────────────────────────────────────────\n");
}

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
