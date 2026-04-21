"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
import { resetPassword } from "@/app/actions/auth";
import type { ActionResult } from "@/app/actions/_types";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    resetPassword,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedChanges(useFormDirty(formRef));

  if (!token) {
    return (
      <AuthShell
        title="Link is missing its token."
        subtitle="Open the reset link from your email, or request a new one."
      >
        <Button href="/forgot-password" size="lg" className="w-full">
          Request a new link
        </Button>
      </AuthShell>
    );
  }

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
      <form ref={formRef} className="space-y-5" action={formAction}>
        <input type="hidden" name="token" value={token} />
        {state && !state.ok && (
          <p
            role="alert"
            className="rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-asbestos)]"
          >
            {state.error}
          </p>
        )}
        <Field label="New password" id="password" required hint="At least 10 characters.">
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={10}
          />
        </Field>
        <Field label="Confirm new password" id="confirm" required>
          <PasswordInput
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            required
            minLength={10}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
