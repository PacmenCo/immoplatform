"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SuccessBanner } from "@/components/ui/SuccessBanner";
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
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(submitContactForm, undefined);

  if (state?.ok) {
    return (
      <SuccessBanner>
        <strong>Thanks — we got your message.</strong> We&apos;ll get back to
        you within 4 business hours on weekdays.
      </SuccessBanner>
    );
  }

  const v = state && !state.ok ? (state.formValues ?? {}) : {};

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      {state && !state.ok ? <ErrorAlert>{state.error}</ErrorAlert> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" id="name">
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="Jane Mertens"
            defaultValue={v.name ?? ""}
            required
            maxLength={120}
          />
        </Field>
        <Field label="Work email" id="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@agency.be"
            defaultValue={v.email ?? ""}
            required
            maxLength={255}
          />
        </Field>
      </div>

      <Field label="Phone" id="phone" hint="Optional — for faster follow-up.">
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+32 470 12 34 56"
          defaultValue={v.phone ?? ""}
          maxLength={40}
        />
      </Field>

      <Field
        label="Subject"
        id="subject"
        hint="Optional — helps us route your request."
      >
        <Input
          id="subject"
          name="subject"
          placeholder="EPC for an apartment in Antwerp"
          defaultValue={v.subject ?? ""}
          maxLength={200}
        />
      </Field>

      <Field label="Message" id="message">
        <Textarea
          id="message"
          name="message"
          rows={6}
          placeholder="Tell us what you're looking for..."
          defaultValue={v.message ?? ""}
          required
          maxLength={4000}
        />
      </Field>

      {/* Honeypot — hidden from real users via inline styles + tabindex.
          Bots that auto-fill every field will populate `website`, and the
          server action silently treats that as a success without persisting
          or emailing. Don't use display:none — some bots skip those. */}
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
        <label htmlFor="website">
          Leave this field empty
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
        <input
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
        />
        <span>
          I agree to be contacted about my inquiry per the privacy policy.
        </span>
      </label>

      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto"
        loading={pending}
      >
        Send message
      </Button>
    </form>
  );
}
