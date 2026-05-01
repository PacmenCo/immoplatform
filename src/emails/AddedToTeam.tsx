/**
 * Added-to-team email — sent when an existing user is added to a team.
 * Platform parity: ExistingUserTeamInvitationMail (welcome half of the flow).
 * Copy lives under `emails.addedToTeam.*`.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { useTranslations } from "next-intl";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";
import { BRAND_NAME } from "@/lib/site";

export type AddedToTeamEmailProps = {
  inviterName: string;
  teamName: string;
  teamRole: string;
  loginUrl: string;
};

export const subjectKey = "emails.addedToTeam.subject";

export function subjectArgs(p: AddedToTeamEmailProps): Record<string, unknown> {
  return { brand: BRAND_NAME, teamName: p.teamName };
}

export default function AddedToTeam(props: AddedToTeamEmailProps) {
  const t = useTranslations("emails.addedToTeam");
  const tCommon = useTranslations("emails.common");
  return (
    <EmailLayout
      preview={t("preview", { teamName: props.teamName })}
      title={t("title", { teamName: props.teamName })}
    >
      <P>
        {t("intro", {
          inviterName: props.inviterName,
          teamName: props.teamName,
          brand: BRAND_NAME,
          teamRole: props.teamRole,
        })}
      </P>
      <P>{t("callToAction")}</P>
      <CtaButton href={props.loginUrl}>{t("ctaButton")}</CtaButton>
      <P style={mutedStyle}>
        {tCommon("openUrlPrefix")}{" "}
        <Link href={props.loginUrl}>{props.loginUrl}</Link>
      </P>
    </EmailLayout>
  );
}

export const previewProps: AddedToTeamEmailProps = {
  inviterName: "Alex Admin",
  teamName: "Downtown Agency",
  teamRole: "member",
  loginUrl: "https://example.com/login",
};
