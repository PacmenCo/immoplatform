"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SuccessBanner } from "@/components/ui/SuccessBanner";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
import {
  updateUserByAdmin,
  resetUserPassword,
} from "@/app/actions/users";
import { ROLE_BADGE } from "@/lib/roleColors";
import type { ActionResult } from "@/app/actions/_types";

export type UserEditInitial = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

export function UserEditForm({ initial }: { initial: UserEditInitial }) {
  const boundUpdate = updateUserByAdmin.bind(null, initial.id);
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundUpdate, undefined);

  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedChanges(useFormDirty(formRef));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Changing the email does not re-verify it — trusted admin update.
          </p>
        </CardHeader>
        <CardBody>
          <form ref={formRef} action={formAction} className="space-y-6">
            {state && !state.ok && <ErrorAlert>{state.error}</ErrorAlert>}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="First name" id="firstName" required>
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={initial.firstName}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label="Last name" id="lastName" required>
                <Input
                  id="lastName"
                  name="lastName"
                  defaultValue={initial.lastName}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label="Email" id="email" required>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={initial.email}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field
                label="Role"
                id="role"
                hint="Controls what this person can access across the platform."
                required
              >
                <Select id="role" name="role" defaultValue={initial.role}>
                  {Object.entries(ROLE_BADGE).map(([role, { label }]) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex items-center justify-end">
              <Button type="submit" size="md" loading={pending}>
                Save profile
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <PasswordResetCard userId={initial.id} />
    </div>
  );
}

function PasswordResetCard({ userId }: { userId: string }) {
  const boundReset = resetUserPassword.bind(null, userId);
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundReset, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 4000);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Sets a new password for this user. Every active session is revoked so the old password stops working immediately. The user is not emailed — share the new password out-of-band.
        </p>
      </CardHeader>
      <CardBody>
        <form ref={formRef} action={formAction} className="grid gap-5 sm:max-w-md">
          {state && !state.ok && <ErrorAlert>{state.error}</ErrorAlert>}
          {justSaved && <SuccessBanner>Password reset. Other sessions signed out.</SuccessBanner>}
          <Field
            label="New password"
            id="admin-reset-password"
            hint="At least 8 characters including a letter and a number."
            required
          >
            <PasswordInput
              id="admin-reset-password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <Field label="Confirm new password" id="admin-reset-confirm" required>
            <PasswordInput
              id="admin-reset-confirm"
              name="confirm"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <div>
            <Button type="submit" variant="secondary" size="md" loading={pending}>
              Reset password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
