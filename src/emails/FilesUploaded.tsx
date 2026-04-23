/**
 * Files-uploaded email. Sent when either freelancer or realtor uploads
 * files on an assignment. Platform parity: AssignmentFilesUploaded.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";
import { addressLine, demoCtx, type AssignmentEmailCtx } from "./_assignment";

export type FilesUploadedEmailProps = AssignmentEmailCtx & {
  recipientName: string;
  uploaderName: string;
  lane: "freelancer" | "realtor";
  fileCount: number;
};

export const subject = (p: FilesUploadedEmailProps) =>
  `New files: ${addressLine(p)} (${p.reference})`;

export default function FilesUploaded(props: FilesUploadedEmailProps) {
  const filesUrl = `${props.assignmentUrl}/files`;
  const what =
    props.lane === "freelancer"
      ? `delivered ${props.fileCount} file${props.fileCount === 1 ? "" : "s"}`
      : `uploaded ${props.fileCount} supporting file${props.fileCount === 1 ? "" : "s"}`;
  return (
    <EmailLayout
      preview={`${props.uploaderName} ${what} on ${props.reference}`}
      title="New files uploaded"
    >
      <P>Hi {props.recipientName},</P>
      <P>
        {props.uploaderName} {what} on <strong>{props.reference}</strong> (
        {addressLine(props)}).
      </P>
      <CtaButton href={filesUrl}>View the files</CtaButton>
      <P style={mutedStyle}>
        Or open this URL: <Link href={filesUrl}>{filesUrl}</Link>
      </P>
    </EmailLayout>
  );
}

export const previewProps: FilesUploadedEmailProps = {
  ...demoCtx,
  recipientName: "Sam",
  uploaderName: "Pat Inspector",
  lane: "freelancer",
  fileCount: 3,
};
