"use client";

import { Link } from "@/i18n/navigation";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input, Select } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { register } from "@/app/actions/auth";
import { useTranslateError } from "@/i18n/error";
import type { ActionResult } from "@/app/actions/_types";

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const tErr = useTranslateError();
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    register,
    undefined,
  );
  const v = state && !state.ok ? state.formValues ?? {} : {};

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
      <form className="space-y-5" action={formAction}>
        {state && !state.ok && (
          <p
            role="alert"
            className="rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-asbestos)]"
          >
            {tErr(state.error)}
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("firstName")} id="firstName" required>
            <Input id="firstName" name="firstName" autoComplete="given-name" required defaultValue={v.firstName ?? ""} />
          </Field>
          <Field label={t("lastName")} id="lastName" required>
            <Input id="lastName" name="lastName" autoComplete="family-name" required defaultValue={v.lastName ?? ""} />
          </Field>
        </div>
        <Field label={t("agency")} id="agency" hint={t("agencyHint")}>
          <Input id="agency" name="agency" placeholder={t("agencyPlaceholder")} defaultValue={v.agency ?? ""} />
        </Field>
        <Field label={t("email")} id="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            required
            defaultValue={v.email ?? ""}
          />
        </Field>
        <Field label={t("password")} id="password" hint={t("passwordHint")} required>
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
        <Field label={t("region")} id="region">
          <Select id="region" name="region" defaultValue={v.region || "Flanders"}>
            <option value="Flanders">{t("regions.flanders")}</option>
            <option value="Brussels">{t("regions.brussels")}</option>
            <option value="Wallonia">{t("regions.wallonia")}</option>
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
            {t("termsPrefix")}{" "}
            <Link href="/legal/terms" className="underline">
              {t("termsLink")}
            </Link>{" "}
            {t("termsAnd")}{" "}
            <Link href="/legal/privacy" className="underline">
              {t("privacyLink")}
            </Link>
            .
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {t("submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
