"use client";

import { Link } from "@/i18n/navigation";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { forgotPassword } from "@/app/actions/auth";
import { useTranslateError } from "@/i18n/error";
import type { ActionResult } from "@/app/actions/_types";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const tErr = useTranslateError();
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    forgotPassword,
    undefined,
  );

  const sent = state?.ok === true;

  return (
    <AuthShell
      title={sent ? t("sentHeading") : t("heading")}
      subtitle={sent ? t("sentSubtitle") : t("subtitle")}
      footer={
        <>
          {t("footerPrompt")}{" "}
          <Link href="/login" className="font-medium text-[var(--color-ink)] hover:underline">
            {t("footerCta")}
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-4 text-sm text-[var(--color-ink-soft)]">
          <p>{t("sentBody")}</p>
          <Button href="/login" size="lg" className="w-full">
            {t("footerCta")}
          </Button>
        </div>
      ) : (
        <form className="space-y-5" action={formAction}>
          {state && !state.ok && (
            <p
              role="alert"
              className="rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-asbestos)]"
            >
              {tErr(state.error)}
            </p>
          )}
          <Field label={t("email")} id="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              required
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={pending}>
            {t("submit")}
          </Button>
          <p className="text-xs text-[var(--color-ink-muted)]">
            {t("expiryHint")}
          </p>
        </form>
      )}
    </AuthShell>
  );
}
