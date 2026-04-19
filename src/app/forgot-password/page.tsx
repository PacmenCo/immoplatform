import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password."
      subtitle="Enter the email tied to your account and we&rsquo;ll send a secure reset link."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-[var(--color-ink)] hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      <form className="space-y-5">
        <Field label="Work email" id="email">
          <Input id="email" type="email" autoComplete="email" placeholder="you@agency.be" />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          Send reset link
        </Button>
        <p className="text-xs text-[var(--color-ink-muted)]">
          The link expires in 30 minutes. Check your spam folder if it doesn&apos;t arrive.
        </p>
      </form>
    </AuthShell>
  );
}
