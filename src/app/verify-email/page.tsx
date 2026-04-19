import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { IconMail } from "@/components/ui/Icons";

export default function VerifyEmailPage() {
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
          <Button type="button" size="lg" className="w-full">
            Resend verification email
          </Button>
          <Button href="/login" variant="secondary" size="lg" className="w-full">
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
