"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input, Select } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { register } from "@/app/actions/auth";
import type { ActionResult } from "@/app/actions/_types";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    register,
    undefined,
  );

  return (
    <AuthShell
      title="Create your agency account."
      subtitle="Takes under 2 minutes. First assignment is on us."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--color-ink)] hover:underline">
            Log in
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" id="firstName" required>
            <Input id="firstName" name="firstName" autoComplete="given-name" required />
          </Field>
          <Field label="Last name" id="lastName" required>
            <Input id="lastName" name="lastName" autoComplete="family-name" required />
          </Field>
        </div>
        <Field label="Agency name" id="agency" hint="Optional — shown on your profile.">
          <Input id="agency" name="agency" placeholder="Vastgoed Antwerp" />
        </Field>
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
        <Field label="Password" id="password" hint="At least 10 characters." required>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={10}
          />
        </Field>
        <Field label="Confirm password" id="confirm" required>
          <PasswordInput
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            required
            minLength={10}
          />
        </Field>
        <Field label="Region" id="region">
          <Select id="region" name="region" defaultValue="Flanders">
            <option value="Flanders">Flanders</option>
            <option value="Brussels">Brussels</option>
            <option value="Wallonia">Wallonia</option>
          </Select>
        </Field>

        <label className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
          />
          <span>
            I agree to the{" "}
            <Link href="/legal/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
