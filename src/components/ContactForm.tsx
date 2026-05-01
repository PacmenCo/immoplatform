"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SuccessBanner } from "@/components/ui/SuccessBanner";
import { useTranslateError } from "@/i18n/error";
import { submitContactForm } from "@/app/actions/contact";
import type { ActionResult } from "@/app/actions/_types";

/**
 * Public contact form. POSTs to `submitContactForm` server action.
 * Honeypot field (`website`) is hidden from real users — bots that fill
 * every field trip it; the action silently returns ok in that case.
 *
 * On success the form is replaced with a thank-you banner so the visitor
 * can't accidentally re-submit.
 */
export function ContactForm() {
  const t = useTranslations("home.contact.form");
  const tErr = useTranslateError();
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(submitContactForm, undefined);

  if (state?.ok) {
    return (
      <SuccessBanner>
        <strong>{t("successTitle")}</strong> {t("successBody")}
      </SuccessBanner>
    );
  }

  const v = state && !state.ok ? (state.formValues ?? {}) : {};

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      {state && !state.ok ? <ErrorAlert>{tErr(state.error)}</ErrorAlert> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("fullName")} id="name">
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder={t("fullNamePlaceholder")}
            defaultValue={v.name ?? ""}
            required
            maxLength={120}
          />
        </Field>
        <Field label={t("email")} id="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            defaultValue={v.email ?? ""}
            required
            maxLength={255}
          />
        </Field>
      </div>

      <Field label={t("phone")} id="phone" hint={t("phoneHint")}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder={t("phonePlaceholder")}
          defaultValue={v.phone ?? ""}
          maxLength={40}
        />
      </Field>

      <Field
        label={t("subject")}
        id="subject"
        hint={t("subjectHint")}
      >
        <Input
          id="subject"
          name="subject"
          placeholder={t("subjectPlaceholder")}
          defaultValue={v.subject ?? ""}
          maxLength={200}
        />
      </Field>

      <Field label={t("message")} id="message">
        <Textarea
          id="message"
          name="message"
          rows={6}
          placeholder={t("messagePlaceholder")}
          defaultValue={v.message ?? ""}
          required
          maxLength={4000}
        />
      </Field>

      {/* Honeypot — hidden from real users via off-screen positioning.
          Bots that auto-fill every field populate `website`, and the server
          action silently treats that as a success without persisting or
          emailing. Don't use display:none — some bots skip those.
          aria-hidden + tabIndex={-1} + autoComplete="off" keeps it out of
          the AT tree and tab order. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-10000px",
          top: "auto",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto"
        loading={pending}
      >
        {t("submit")}
      </Button>
    </form>
  );
}
