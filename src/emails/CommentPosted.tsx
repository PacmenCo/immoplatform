/**
 * Comment-posted email. Sent to participants on an assignment thread when
 * someone else comments.
 */

import * as React from "react";
import { EmailLayout, P } from "./_layout";
import {
  AssignmentCta,
  addressLine,
  demoCtx,
  type AssignmentEmailCtx,
} from "./_assignment";

export type CommentPostedEmailProps = AssignmentEmailCtx & {
  recipientName: string;
  authorName: string;
  body: string;
};

export const subject = (p: CommentPostedEmailProps) =>
  `New comment: ${addressLine(p)} (${p.reference})`;

/**
 * Grapheme-aware truncate — `.slice` splits surrogate pairs and emoji ZWJs
 * which Gmail renders as replacement characters. Array.from works because
 * the iterator yields code points grouped for surrogate pairs.
 */
function preview(body: string): string {
  const chars = Array.from(body);
  return chars.length > 200 ? chars.slice(0, 200).join("") + "…" : body;
}

export default function CommentPosted(props: CommentPostedEmailProps) {
  const snippet = preview(props.body);
  return (
    <EmailLayout
      preview={`${props.authorName} commented on ${props.reference}`}
      title="New comment"
    >
      <P>Hi {props.recipientName},</P>
      <P>
        {props.authorName} commented on <strong>{props.reference}</strong> (
        {addressLine(props)}):
      </P>
      <P
        style={{
          borderLeft: "3px solid #cbd5e1",
          paddingLeft: 12,
          color: "#334155",
          fontStyle: "italic",
        }}
      >
        &ldquo;{snippet}&rdquo;
      </P>
      <P>Reply on the thread:</P>
      <AssignmentCta ctx={props} />
    </EmailLayout>
  );
}

export const previewProps: CommentPostedEmailProps = {
  ...demoCtx,
  recipientName: "Sam",
  authorName: "Pat Inspector",
  body: "Owner confirmed the inspector can access the attic key from the neighbor — Ms. Dupont at no. 44. Will update on-site if anything changes.",
};
