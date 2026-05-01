/**
 * Notification email sent to ops when a visitor submits the public /contact
 * form. Goes to the address in NOTIFY_CONTACT_TO env var (defaults to
 * jordan@asbestexperts.be). The reply-to header is the visitor's email so
 * hitting Reply in the inbox messages them directly.
 *
 * Copy lives under `emails.contactSubmission.*`. Recipient is internal ops
 * so the locale follows the routing default unless an admin overrides.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";

export type ContactSubmissionEmailProps = {
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  submissionId: string;
  adminUrl: string;
};

export const subjectKey = "emails.contactSubmission.subject";

export function subjectArgs(p: ContactSubmissionEmailProps): Record<string, unknown> {
  return { name: p.name };
}

export default function ContactSubmission(props: ContactSubmissionEmailProps) {
  const t = useTranslations("emails.contactSubmission");
  return (
    <EmailLayout
      preview={t("preview", { name: props.name })}
      title={t("title")}
    >
      <P>{t("intro")}</P>

      <P>
        <strong>{t("nameLabel")}</strong> {props.name}
        <br />
        <strong>{t("emailLabel")}</strong> {props.email}
        {props.phone ? (
          <>
            <br />
            <strong>{t("phoneLabel")}</strong> {props.phone}
          </>
        ) : null}
        {props.subject ? (
          <>
            <br />
            <strong>{t("subjectLabel")}</strong> {props.subject}
          </>
        ) : null}
      </P>

      <P>
        <strong>{t("messageHeading")}</strong>
      </P>
      <P style={{ whiteSpace: "pre-wrap" }}>{props.message}</P>

      <CtaButton href={props.adminUrl}>{t("ctaButton")}</CtaButton>
      <P style={mutedStyle}>{t("replyNotice", { email: props.email })}</P>
    </EmailLayout>
  );
}

export const previewProps: ContactSubmissionEmailProps = {
  name: "Sam Visitor",
  email: "sam@example.com",
  phone: "+32 470 12 34 56",
  subject: "EPC for an apartment in Antwerp",
  message:
    "Hi — I have a 2-bedroom apartment in Antwerp 2000 that needs an EPC certificate before sale. When could you do an inspection?",
  submissionId: "preview-id",
  adminUrl: "https://immoplatform.be/dashboard/contact-messages",
};
