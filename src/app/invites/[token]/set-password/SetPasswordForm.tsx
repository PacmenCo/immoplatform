"use client";

import { useActionState, useRef } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Badge } from "@/components/ui/Badge";
import { IconCheck, IconMail } from "@/components/ui/Icons";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
import { acceptInvite } from "@/app/actions/invites";
import type { ActionResult } from "@/app/actions/_types";

const roleColor: Record<string, { bg: string; fg: string; label: string }> = {
  admin: { bg: "#fef2f2", fg: "#b91c1c", label: "Admin" },
  staff: { bg: "#f5f3ff", fg: "#6d28d9", label: "Staff" },
  realtor: { bg: "#eff6ff", fg: "#1d4ed8", label: "Realtor" },
  freelancer: { bg: "#ecfdf5", fg: "#047857", label: "Freelancer" },
};

export function SetPasswordForm({
  token,
  email,
  role,
  team,
}: {
  token: string;
  email: string;
  role: string;
  team: { name: string; teamRole: string } | null;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    acceptInvite,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedChanges(useFormDirty(formRef));
  const rc = roleColor[role] ?? roleColor.realtor;

  return (
    <AuthShell
      title="Create your password."
      subtitle="One last step — pick a password to finish setting up your account."
      footer={
        <>
          Wrong account?{" "}
          <a
            href={`/invites/${token}`}
            className="font-medium text-[var(--color-ink)] hover:underline"
          >
            Go back
          </a>
        </>
      }
    >
      <div className="space-y-6">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            Setting up account for
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <IconMail size={14} className="text-[var(--color-ink-muted)]" />
            <span className="font-medium text-[var(--color-ink)]">{email}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-soft)]">
            <Badge bg={rc.bg} fg={rc.fg} size="sm">{rc.label}</Badge>
            {team && (
              <>
                <span className="text-[var(--color-ink-faint)]">·</span>
                <span>{team.name} ({team.teamRole})</span>
              </>
            )}
          </div>
        </div>

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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" id="firstName" required>
              <Input id="firstName" name="firstName" autoComplete="given-name" required />
            </Field>
            <Field label="Last name" id="lastName" required>
              <Input id="lastName" name="lastName" autoComplete="family-name" required />
            </Field>
          </div>

          <Field label="Work email" id="email">
            <Input
              id="email"
              type="email"
              defaultValue={email}
              readOnly
              disabled
              autoComplete="email"
            />
          </Field>

          <Field
            label="Password"
            id="password"
            required
            hint="At least 10 characters."
          >
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

          <label className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
              required
            />
            <span>
              I agree to the{" "}
              <a href="/legal/terms" className="underline">Terms</a> and{" "}
              <a href="/legal/privacy" className="underline">Privacy Policy</a>.
            </span>
          </label>

          <Button type="submit" size="lg" className="w-full" loading={pending}>
            <IconCheck size={16} />
            Create account
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
