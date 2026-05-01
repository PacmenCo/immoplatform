"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SuccessBanner } from "@/components/ui/SuccessBanner";
import { changePassword } from "@/app/actions/security";
import { useTranslateError } from "@/i18n/error";
import type { ActionResult } from "@/app/actions/_types";

export function PasswordChangeForm() {
  const t = useTranslations("dashboard.settings.security.password");
  const tErr = useTranslateError();
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
      const tm = setTimeout(() => setJustSaved(false), 4000);
      return () => clearTimeout(tm);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-5 sm:max-w-md">
      {state && !state.ok && <ErrorAlert>{tErr(state.error)}</ErrorAlert>}
      {justSaved && <SuccessBanner>{t("saved")}</SuccessBanner>}

      <Field label={t("current")} id="currentPassword" required>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      </Field>
      <Field
        label={t("new")}
        id="newPassword"
        hint={t("newHint")}
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
      <Field label={t("confirm")} id="confirmPassword" required>
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
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
