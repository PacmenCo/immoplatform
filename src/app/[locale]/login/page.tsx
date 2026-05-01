"use client";

import { Link } from "@/i18n/navigation";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { login } from "@/app/actions/auth";
import { useTranslateError } from "@/i18n/error";
import type { ActionResult } from "@/app/actions/_types";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const tErr = useTranslateError();
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    login,
    undefined,
  );
  const v = state && !state.ok ? state.formValues ?? {} : {};
  // Platform parity (`Login.php` `redirect()->intended(...)`). A user who
  // followed an email link to a deep dashboard URL while signed-out lands
  // here with `?next=/dashboard/assignments/abc`. We thread the param into
  // a hidden field so the server action can validate it and redirect there
  // on success.
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";

  return (
    <AuthShell
      title={t("heading")}
      subtitle={t("subtitle")}
      footer={
        <>
          {t("footerPrompt")}{" "}
          <Link href="/register" className="font-medium text-[var(--color-ink)] hover:underline">
            {t("footerCta")}
          </Link>
        </>
      }
    >
      <form className="space-y-5" action={formAction}>
        {next && <input type="hidden" name="next" value={next} />}
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
            defaultValue={v.email ?? ""}
          />
        </Field>
        <Field label={t("password")} id="password" required>
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
            {t("forgotPassword")}
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {t("submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
