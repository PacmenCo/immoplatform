"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { login } from "@/app/actions/auth";
import type { ActionResult } from "@/app/actions/_types";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    login,
    undefined,
  );
  const v = state && !state.ok ? state.formValues ?? {} : {};

  return (
    <AuthShell
      title="Welcome back."
      subtitle="Log in to manage your assignments and teams."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-[var(--color-ink)] hover:underline">
            Create one
          </Link>
        </>
      }
    >
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
            defaultValue={v.email ?? ""}
          />
        </Field>
        <Field label="Password" id="password" required>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <div className="flex items-center justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-[var(--color-ink)] hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
