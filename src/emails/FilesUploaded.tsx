/**
 * Files-uploaded email. Sent when either freelancer or realtor uploads
 * files on an assignment. Platform parity: AssignmentFilesUploaded.
 * Copy lives under `emails.filesUploaded.*`.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { useTranslations } from "next-intl";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";
import { addressLine, demoCtx, type AssignmentEmailCtx } from "./_assignment";

export type FilesUploadedEmailProps = AssignmentEmailCtx & {
  recipientName: string;
  uploaderName: string;
  lane: "freelancer" | "realtor";
  fileCount: number;
};

export const subjectKey = "emails.filesUploaded.subject";

export function subjectArgs(
  p: FilesUploadedEmailProps,
): Record<string, unknown> {
  return { address: addressLine(p), reference: p.reference };
}

/**
 * Build the localized "what" fragment ("uploaded N deliverables" / "uploaded
 * N supporting files") from a lane + count. Lane × singular/plural × locale
 * cross product = 4 keys, simpler than ICU select inside the parent string.
 */
function whatKey(lane: "freelancer" | "realtor", count: number): string {
  const singular = count === 1;
  if (lane === "freelancer") {
    return singular ? "freelancerSingular" : "freelancerPlural";
  }
  return singular ? "realtorSingular" : "realtorPlural";
}

export default function FilesUploaded(props: FilesUploadedEmailProps) {
  const t = useTranslations("emails.filesUploaded");
  const tCommon = useTranslations("emails.common");
  const filesUrl = `${props.assignmentUrl}/files`;
  // Dynamic key resolution — next-intl's typed translator narrows the key
  // arg to the literal union of leaves; we know the four lane×count keys
  // exist so cast through a permissive signature.
  const tDynamic = t as unknown as (
    k: string,
    args?: Record<string, unknown>,
  ) => string;
  const what = tDynamic(whatKey(props.lane, props.fileCount), {
    count: props.fileCount,
  });
  return (
    <EmailLayout
      preview={t("preview", {
        uploaderName: props.uploaderName,
        what,
        reference: props.reference,
      })}
      title={t("title")}
    >
      <P>{tCommon("hi", { name: props.recipientName })}</P>
      <P>
        {t("body", {
          uploaderName: props.uploaderName,
          what,
          reference: props.reference,
          address: addressLine(props),
        })}
      </P>
      <CtaButton href={filesUrl}>{t("ctaButton")}</CtaButton>
      <P style={mutedStyle}>
        {tCommon("openUrlPrefix")} <Link href={filesUrl}>{filesUrl}</Link>
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
