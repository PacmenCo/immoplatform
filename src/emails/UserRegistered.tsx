/**
 * Sent to platform admins when someone completes self-serve sign-up.
 * Lets the team notice new accounts so they can reach out / verify.
 * Platform parity: EmailTypesSeeder `user_registered`. Copy lives under
 * `emails.userRegistered.*`.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { useTranslations } from "next-intl";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";

export type UserRegisteredEmailProps = {
  newUserName: string;
  newUserEmail: string;
  newUserRole: string;
  agency?: string | null;
  region?: string | null;
  usersUrl: string;
};

export const subjectKey = "emails.userRegistered.subject";

export function subjectArgs(p: UserRegisteredEmailProps): Record<string, unknown> {
  return { name: p.newUserName, role: p.newUserRole };
}

export default function UserRegistered(props: UserRegisteredEmailProps) {
  const t = useTranslations("emails.userRegistered");
  const tCommon = useTranslations("emails.common");
  return (
    <EmailLayout
      preview={t("preview", { name: props.newUserName, role: props.newUserRole })}
      title={t("title")}
    >
      <P>{t("greeting")}</P>
      <P>{t("intro", { name: props.newUserName, role: props.newUserRole })}</P>
      <P style={mutedStyle}>
        {t("emailLabel")}{" "}
        <Link href={`mailto:${props.newUserEmail}`}>{props.newUserEmail}</Link>
        {props.agency ? (
          <>
            <br />
            {t("agencyLabel")} {props.agency}
          </>
        ) : null}
        {props.region ? (
          <>
            <br />
            {t("regionLabel")} {props.region}
          </>
        ) : null}
      </P>
      <CtaButton href={props.usersUrl}>{t("ctaButton")}</CtaButton>
      <P style={mutedStyle}>
        {tCommon("openUrlPrefix")}{" "}
        <Link href={props.usersUrl}>{props.usersUrl}</Link>
      </P>
    </EmailLayout>
  );
}

export const previewProps: UserRegisteredEmailProps = {
  newUserName: "Riley Parker",
  newUserEmail: "riley@parkerproperties.be",
  newUserRole: "realtor",
  agency: "Parker Properties",
  region: "Brussels",
  usersUrl: "https://example.com/dashboard/users",
};
