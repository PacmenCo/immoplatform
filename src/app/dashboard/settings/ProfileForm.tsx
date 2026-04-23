"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SuccessBanner } from "@/components/ui/SuccessBanner";
import {
  updateProfile,
  uploadAvatar,
  removeAvatar,
  resendEmailVerification,
} from "@/app/actions/profile";
import { SettingsSaveBar } from "@/components/dashboard/SettingsSaveBar";
import { AVATAR_ACCEPT_ATTR, AVATAR_MAX_BYTES } from "@/lib/avatar";
import type { ActionResult } from "@/app/actions/_types";

export type ProfileFormInitial = {
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  phone: string | null;
  region: string | null;
  bio: string | null;
  avatarInitials: string;
  avatarAlt: string;
  avatarUrl: string | null;
};

export function ProfileForm({ initial }: { initial: ProfileFormInitial }) {
  return (
    <div className="space-y-6">
      {!initial.emailVerified && <UnverifiedEmailBanner email={initial.email} />}
      <AvatarCard initial={initial} />
      <DetailsCard initial={initial} />
    </div>
  );
}

function UnverifiedEmailBanner({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionResult | null>(null);

  function resend() {
    setState(null);
    start(async () => {
      const res = await resendEmailVerification();
      setState(res);
    });
  }

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-[color-mix(in_srgb,var(--color-electrical)_40%,var(--color-bg))] bg-[color-mix(in_srgb,var(--color-electrical)_10%,var(--color-bg))] p-4"
    >
      <span
        aria-hidden
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-electrical)] text-xs font-bold text-white"
      >
        !
      </span>
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-medium text-[var(--color-ink)]">
          Verify your email address
        </p>
        <p className="text-[var(--color-ink-soft)]">
          We sent a link to <span className="font-mono text-xs">{email}</span>.
          Click it to confirm the address so we can send you account notifications.
        </p>
        {state?.ok && (
          <p className="mt-2 text-xs text-[var(--color-epc)]">
            Verification email sent — check your inbox (and spam).
          </p>
        )}
        {state && !state.ok && (
          <p className="mt-2 text-xs text-[var(--color-asbestos)]">{state.error}</p>
        )}
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={resend}
        loading={pending}
      >
        Resend email
      </Button>
    </div>
  );
}

function ActionBanner({
  state,
  successLabel,
}: {
  state: ActionResult | undefined;
  successLabel: string;
}) {
  if (!state) return null;
  if (!state.ok) return <ErrorAlert>{state.error}</ErrorAlert>;
  return <SuccessBanner>{successLabel}</SuccessBanner>;
}

function DetailsCard({ initial }: { initial: ProfileFormInitial }) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateProfile, undefined);

  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Shown on comments, assignments and team pages.
        </p>
      </CardHeader>
      <CardBody>
        <form ref={formRef} action={formAction} className="space-y-6">
          <ActionBanner state={state} successLabel="Profile saved." />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="First name" id="firstName" required>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={initial.firstName}
                autoComplete="given-name"
                required
              />
            </Field>
            <Field label="Last name" id="lastName" required>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={initial.lastName}
                autoComplete="family-name"
                required
              />
            </Field>
            <Field
              label="Email"
              id="email"
              hint={
                initial.emailVerified
                  ? "Changing this sends a verification link to the new address."
                  : "Not verified. Save to resend, or use the banner above."
              }
              required
            >
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={initial.email}
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Phone" id="phone">
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={initial.phone ?? ""}
                placeholder="+32 …"
                autoComplete="tel"
              />
            </Field>
            <Field label="Region" id="region" hint="City or province.">
              <Input
                id="region"
                name="region"
                defaultValue={initial.region ?? ""}
                placeholder="Antwerp"
                autoComplete="address-level1"
              />
            </Field>
          </div>

          <Field
            label="Bio"
            id="bio"
            hint="Optional — a short note that appears on your profile."
          >
            <Textarea
              id="bio"
              name="bio"
              rows={3}
              defaultValue={initial.bio ?? ""}
              maxLength={500}
            />
          </Field>

          <SettingsSaveBar
            formRef={formRef}
            pending={pending}
            label="Save profile"
          />
        </form>
      </CardBody>
    </Card>
  );
}

const AVATAR_MAX_MB = Math.round(AVATAR_MAX_BYTES / (1024 * 1024));

function AvatarCard({ initial }: { initial: ProfileFormInitial }) {
  const [uploadState, uploadAction, uploading] = useActionState<
    ActionResult | undefined,
    FormData
  >(uploadAvatar, undefined);
  const [removeState, removeAction, removing] = useActionState<
    ActionResult | undefined,
    FormData
  >(async () => removeAvatar(), undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photo</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Appears next to your name across the dashboard.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar
            initials={initial.avatarInitials}
            imageUrl={initial.avatarUrl}
            alt={initial.avatarAlt}
            size="lg"
            color="#0f172a"
          />
          <form action={uploadAction} className="flex-1">
            <input
              type="file"
              name="avatar"
              accept={AVATAR_ACCEPT_ATTR}
              className="block w-full max-w-sm text-sm text-[var(--color-ink-soft)] file:mr-3 file:rounded-md file:border file:border-[var(--color-border-strong)] file:bg-[var(--color-bg)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-ink)] hover:file:bg-[var(--color-bg-muted)]"
            />
            <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
              PNG, JPG or WebP — max {AVATAR_MAX_MB} MB.
            </p>
            <div className="mt-3">
              <Button type="submit" variant="secondary" size="sm" loading={uploading}>
                Upload
              </Button>
            </div>
          </form>
          {initial.avatarUrl && (
            <form action={removeAction}>
              <Button type="submit" variant="ghost" size="sm" loading={removing}>
                Remove
              </Button>
            </form>
          )}
        </div>
        <ActionBanner state={uploadState} successLabel="Photo updated." />
        <ActionBanner state={removeState} successLabel="Photo removed." />
      </CardBody>
    </Card>
  );
}
