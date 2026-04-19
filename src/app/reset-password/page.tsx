import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password."
      subtitle="Use at least 10 characters. A mix of words, numbers and symbols is ideal."
      footer={
        <>
          Changed your mind?{" "}
          <Link href="/login" className="font-medium text-[var(--color-ink)] hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      <form className="space-y-5">
        <Field label="New password" id="password" hint="At least 10 characters.">
          <Input id="password" type="password" autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" id="confirm">
          <Input id="confirm" type="password" autoComplete="new-password" />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
