"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SuccessBanner } from "@/components/ui/SuccessBanner";
import { changePassword } from "@/app/actions/security";
import type { ActionResult } from "@/app/actions/_types";

export function PasswordChangeForm() {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(changePassword, undefined);

  const formRef = useRef<HTMLFormElement>(null);
  const [justSaved, setJustSaved] = useState(false);

  // On a successful run, clear the inputs and flash the success banner.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 4000);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-5 sm:max-w-md">
      {state && !state.ok && <ErrorAlert>{state.error}</ErrorAlert>}
      {justSaved && <SuccessBanner>Password updated. Other active sessions have been signed out.</SuccessBanner>}

      <Field label="Current password" id="currentPassword" required>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      </Field>
      <Field
        label="New password"
        id="newPassword"
        hint="At least 8 characters, including a letter and a number."
        required
      >
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <Field label="Confirm new password" id="confirmPassword" required>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <div>
        <Button type="submit" variant="primary" size="md" loading={pending}>
          Update password
        </Button>
      </div>
    </form>
  );
}
