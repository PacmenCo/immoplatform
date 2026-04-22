import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { IconMail } from "@/components/ui/Icons";
import { confirmEmailVerification } from "@/app/actions/profile";

type SearchParams = Promise<{ token?: string }>;

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token } = await searchParams;

  // Two modes:
  //   ?token=…  → consume the token and show confirm/error
  //   no token  → "check your inbox" landing (post-registration flow)
  if (token) {
    const result = await confirmEmailVerification(token);
    if (result.ok) {
      return (
        <AuthShell
          title="Email verified."
          subtitle={`${result.data?.email ?? "Your address"} is now confirmed. You're all set.`}
          footer={
            <>
              Done here?{" "}
              <Link href="/dashboard/settings" className="font-medium text-[var(--color-ink)] hover:underline">
                Back to settings
              </Link>
            </>
          }
        >
          <div className="space-y-6">
            <div className="flex items-start gap-4 rounded-[var(--radius-md)] border border-[var(--color-epc)]/30 bg-[color-mix(in_srgb,var(--color-epc)_8%,var(--color-bg))] p-5">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[var(--color-epc)] text-white">
                <IconMail size={18} />
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">Thanks for confirming</p>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                  Account notifications and password resets will now land at this address.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <Button href="/dashboard" size="lg" className="w-full">
                Go to dashboard
              </Button>
              <Button href="/dashboard/settings" variant="secondary" size="lg" className="w-full">
                Back to settings
              </Button>
            </div>
          </div>
        </AuthShell>
      );
    }
    return (
      <AuthShell
        title="We couldn't verify that link."
        subtitle={result.error}
        footer={
          <>
            Need help?{" "}
            <a href="mailto:support@immo.be" className="font-medium text-[var(--color-ink)] hover:underline">
              Contact support
            </a>
          </>
        }
      >
        <div className="space-y-6">
          <p className="text-sm text-[var(--color-ink-soft)]">
            Verification links expire after 24 hours and can only be used once. Sign in
            and request a fresh link from your settings.
          </p>
          <div className="space-y-3">
            <Button href="/dashboard/settings" size="lg" className="w-full">
              Request a new link
            </Button>
            <Button href="/login" variant="secondary" size="lg" className="w-full">
              Back to log in
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  // No token → post-registration "check your inbox" landing.
  return (
    <AuthShell
      title="Check your inbox."
      subtitle="We just sent a verification link to your work email. Click it to activate your account."
      footer={
        <>
          Wrong email?{" "}
          <Link href="/register" className="font-medium text-[var(--color-ink)] hover:underline">
            Start over
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-start gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-white text-[var(--color-ink)]">
            <IconMail size={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">The email is on its way</p>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              It usually arrives within a minute. Check your spam folder if it doesn&apos;t show up.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button href="/login" size="lg" className="w-full">
            Back to log in
          </Button>
        </div>

        <p className="text-xs text-[var(--color-ink-muted)]">
          Still nothing after 5 minutes? Email{" "}
          <a href="mailto:support@immo.be" className="font-medium text-[var(--color-ink)] hover:underline">
            support@immo.be
          </a>{" "}
          and we&apos;ll verify you manually.
        </p>
      </div>
    </AuthShell>
  );
}
