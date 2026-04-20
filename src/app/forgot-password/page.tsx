"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { forgotPassword } from "@/app/actions/auth";
import type { ActionResult } from "@/app/actions/invites";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    forgotPassword,
    undefined,
  );

  const sent = state?.ok === true;

  return (
    <AuthShell
      title={sent ? "Check your inbox." : "Reset your password."}
      subtitle={
        sent
          ? "If an account exists with that email, we've sent a secure reset link."
          : "Enter the email tied to your account and we'll send a secure reset link."
      }
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-[var(--color-ink)] hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-4 text-sm text-[var(--color-ink-soft)]">
          <p>The link expires in 1 hour. Check your spam folder if it doesn&apos;t arrive.</p>
          <Button href="/login" size="lg" className="w-full">
            Back to log in
          </Button>
        </div>
      ) : (
        <form className="space-y-5" action={formAction}>
          {state && !state.ok && (
            <p
              role="alert"
              className="rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-asbestos)]"
            >
              {state.error}
            </p>
          )}
          <Field label="Work email" id="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@agency.be"
              required
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={pending}>
            Send reset link
          </Button>
          <p className="text-xs text-[var(--color-ink-muted)]">
            The link expires in 1 hour.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
