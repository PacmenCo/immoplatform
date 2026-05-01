"use client";

import { Link } from "@/i18n/navigation";
import { useActionState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
import { resetPassword } from "@/app/actions/auth";
import { useTranslateError } from "@/i18n/error";
import type { ActionResult } from "@/app/actions/_types";

export default function ResetPasswordPage() {
  const t = useTranslations("auth.resetPassword");
  const tErr = useTranslateError();
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
        title={t("missingTokenHeading")}
        subtitle={t("missingTokenSubtitle")}
      >
        <Button href="/forgot-password" size="lg" className="w-full">
          {t("requestNewLink")}
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("heading")}
      subtitle={t("subtitle")}
      footer={
        <>
          {t("footerPrompt")}{" "}
          <Link href="/login" className="font-medium text-[var(--color-ink)] hover:underline">
            {t("footerCta")}
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
            {tErr(state.error)}
          </p>
        )}
        <Field label={t("newPassword")} id="password" required hint={t("newPasswordHint")}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={10}
          />
        </Field>
        <Field label={t("confirmPassword")} id="confirm" required>
          <PasswordInput
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            required
            minLength={10}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {t("submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
