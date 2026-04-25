import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { IconBuilding, IconMapPin, IconShield, IconCheck } from "@/components/ui/Icons";
import { getInviteByToken } from "@/app/actions/invites";
import { getSession } from "@/lib/auth";
import { AlreadySignedIn } from "./AlreadySignedIn";

const roleColor: Record<string, { bg: string; fg: string; label: string }> = {
  admin: { bg: "#fef2f2", fg: "#b91c1c", label: "Admin" },
  staff: { bg: "#f5f3ff", fg: "#6d28d9", label: "Staff" },
  realtor: { bg: "#eff6ff", fg: "#1d4ed8", label: "Realtor" },
  freelancer: { bg: "#ecfdf5", fg: "#047857", label: "Freelancer" },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [result, session] = await Promise.all([getInviteByToken(token), getSession()]);

  if (result.status !== "ok") {
    return <InviteProblem status={result.status} />;
  }

  const invite = result.invite;

  if (session) {
    return (
      <AlreadySignedIn
        currentEmail={session.user.email}
        inviteEmail={invite.email}
        continueHref={`/invites/${token}`}
      />
    );
  }
  const rc = roleColor[invite.role] ?? roleColor.realtor;
  const daysLeft = Math.max(
    1,
    Math.ceil((invite.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
  const inviterInitials =
    invite.invitedBy.firstName[0] + invite.invitedBy.lastName[0];

  return (
    <AuthShell
      title="You've been invited."
      subtitle="Set up your account and join your colleagues on Immo."
      footer={<>Invite expires in {daysLeft} day{daysLeft === 1 ? "" : "s"}.</>}
    >
      <div className="space-y-6">
        {/* Inviter */}
        <div className="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
          <Avatar initials={inviterInitials.toUpperCase()} size="md" color="#0f172a" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--color-ink-soft)]">
              <span className="font-semibold text-[var(--color-ink)]">
                {invite.invitedBy.firstName} {invite.invitedBy.lastName}
              </span>{" "}
              invited you
            </p>
            <p className="text-xs text-[var(--color-ink-muted)]">{invite.email}</p>
            {invite.note && (
              <p className="mt-3 rounded border-l-2 border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm italic text-[var(--color-ink-soft)]">
                &ldquo;{invite.note}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Access */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            Your access
          </p>
          <div className="mt-4 flex items-center gap-3">
            <IconShield size={16} className="shrink-0 text-[var(--color-ink-muted)]" />
            <span className="text-sm text-[var(--color-ink-soft)]">Role</span>
            <Badge bg={rc.bg} fg={rc.fg} size="md">{rc.label}</Badge>
          </div>

          {invite.team && (
            <>
              <hr className="my-4 border-[var(--color-border)]" />
              <div className="flex items-start gap-3">
                <IconBuilding size={16} className="mt-0.5 shrink-0 text-[var(--color-ink-muted)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--color-ink-soft)]">Team</p>
                  <div className="mt-1 flex items-center gap-3">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                      style={{ backgroundColor: invite.team.logoColor ?? "#0f172a" }}
                    >
                      {invite.team.logo ?? "??"}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--color-ink)]">{invite.team.name}</p>
                      <p className="flex items-center gap-1 text-xs text-[var(--color-ink-muted)]">
                        <IconMapPin size={12} />
                        {invite.team.city}
                      </p>
                    </div>
                  </div>
                  {invite.teamRole && (
                    <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
                      Joining as a{" "}
                      <span
                        className={
                          "inline-flex items-center gap-1 font-semibold " +
                          (invite.teamRole === "owner"
                            ? "text-[var(--color-brand)]"
                            : "text-[var(--color-ink)]")
                        }
                      >
                        {invite.teamRole === "owner" && <IconShield size={12} />}
                        {invite.teamRole === "owner" ? "Team owner" : "Team member"}
                      </span>
                      {invite.teamRole === "owner" && " — you can invite, edit and manage this team."}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] p-4 text-xs text-[var(--color-ink-soft)]">
          <p className="font-medium text-[var(--color-ink)]">What&apos;s next</p>
          <ul className="space-y-1.5">
            <Step n={1} label="Create a password" active />
            <Step n={2} label="Complete your profile" />
            <Step n={3} label="Start managing certificates" />
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Button href={`/invites/${token}/set-password`} size="lg" className="w-full">
            Accept &amp; create password
          </Button>
          <Button href="/" variant="secondary" size="lg" className="w-full">
            Decline
          </Button>
        </div>

        <p className="text-center text-xs text-[var(--color-ink-muted)]">
          By accepting, you agree to the Immo Terms and Privacy Policy.
        </p>
      </div>
    </AuthShell>
  );
}

function Step({ n, label, active = false }: { n: number; label: string; active?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={
          "grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold " +
          (active
            ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]"
            : "bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]")
        }
      >
        {active ? <IconCheck size={8} /> : n}
      </span>
      <span className={active ? "text-[var(--color-ink)]" : ""}>{label}</span>
    </li>
  );
}

function InviteProblem({ status }: { status: "not_found" | "expired" | "revoked" | "accepted" }) {
  const copy = {
    not_found: {
      title: "Invite not found.",
      body: "This link doesn't match any invite in our system. Double-check the URL or ask for a new invite.",
      cta: { href: "/contact", label: "Contact support" },
    },
    expired: {
      title: "This invite has expired.",
      body: "Invites are only valid for 7 days. Ask whoever invited you to send a fresh one.",
      cta: { href: "/contact", label: "Contact support" },
    },
    revoked: {
      title: "This invite was revoked.",
      body: "Whoever invited you has cancelled the invite. Ask them directly if this was a mistake.",
      cta: { href: "/", label: "Back home" },
    },
    accepted: {
      title: "Already accepted.",
      body: "This invite has already been used. If that was you, sign in with your password.",
      cta: { href: "/login", label: "Go to sign in" },
    },
  }[status];

  return (
    <AuthShell title={copy.title} subtitle={copy.body}>
      <div className="flex flex-col gap-3">
        <Button href={copy.cta.href} size="lg" className="w-full">
          {copy.cta.label}
        </Button>
        <Button href="/" variant="secondary" size="lg" className="w-full">
          Return home
        </Button>
      </div>
      {status === "expired" && (
        <p className="mt-6 text-center text-xs text-[var(--color-ink-muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--color-ink)] underline">
            Sign in
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
