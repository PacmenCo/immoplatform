/**
 * Notification email sent to ops when a visitor submits the public /contact
 * form. Goes to the address in NOTIFY_CONTACT_TO env var (defaults to
 * jordan@asbestexperts.be). The reply-to header is the visitor's email so
 * hitting Reply in the inbox messages them directly.
 */

import * as React from "react";
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

export const subject = (p: ContactSubmissionEmailProps) =>
  `New contact: ${p.name}`;

export default function ContactSubmission(props: ContactSubmissionEmailProps) {
  return (
    <EmailLayout
      preview={`${props.name} got in touch via the website`}
      title="New contact form submission"
    >
      <P>Someone just submitted the contact form on immoplatform.be:</P>

      <P>
        <strong>Name:</strong> {props.name}
        <br />
        <strong>Email:</strong> {props.email}
        {props.phone ? (
          <>
            <br />
            <strong>Phone:</strong> {props.phone}
          </>
        ) : null}
        {props.subject ? (
          <>
            <br />
            <strong>Subject:</strong> {props.subject}
          </>
        ) : null}
      </P>

      <P>
        <strong>Message</strong>
      </P>
      <P style={{ whiteSpace: "pre-wrap" }}>{props.message}</P>

      <CtaButton href={props.adminUrl}>Open in admin dashboard</CtaButton>
      <P style={mutedStyle}>
        Reply to this email goes straight to {props.email}.
      </P>
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
