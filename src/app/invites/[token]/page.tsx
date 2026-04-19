import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { IconBuilding, IconUsers, IconMapPin } from "@/components/ui/Icons";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <AuthShell
      title="You've been invited."
      subtitle="Join your colleagues on Immo and start managing certificates together."
      footer={<>Invite code: <span className="font-mono">{token}</span></>}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
          <Avatar initials="EV" size="md" color="#0f172a" />
          <div className="min-w-0">
            <p className="text-sm text-[var(--color-ink-soft)]">
              <span className="font-semibold text-[var(--color-ink)]">Els Vermeulen</span> invited you
            </p>
            <p className="text-xs text-[var(--color-ink-muted)]">els@vastgoedantwerp.be</p>
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-[var(--color-brand)] text-sm font-bold text-white">
              VA
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-[var(--color-ink)]">Vastgoed Antwerp</p>
              <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
                Role: <span className="font-medium text-[var(--color-ink)]">Realtor</span>
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-[var(--color-ink-soft)]">
                  <IconUsers size={14} className="text-[var(--color-ink-muted)]" />
                  <dt className="sr-only">Members</dt>
                  <dd>12 members</dd>
                </div>
                <div className="flex items-center gap-2 text-[var(--color-ink-soft)]">
                  <IconBuilding size={14} className="text-[var(--color-ink-muted)]" />
                  <dt className="sr-only">Active</dt>
                  <dd>47 active assignments</dd>
                </div>
                <div className="flex items-center gap-2 text-[var(--color-ink-soft)]">
                  <IconMapPin size={14} className="text-[var(--color-ink-muted)]" />
                  <dt className="sr-only">Location</dt>
                  <dd>Antwerpen, Flanders</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button href="/onboarding/profile" size="lg" className="w-full">
            Accept invitation
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
