/**
 * Invite email — sent when an inviter creates a user invite.
 *
 * Platform parity: NewUserTeamInvitationMail / ExistingUserTeamInvitationMail,
 * flattened into a single template since Immo's invite flow is unified.
 *
 * All translatable copy lives in `messages/<locale>/emails.json` under
 * `emails.invite.*`. The template body resolves it via `useTranslations`,
 * scoped by the `IntlProvider` wrapper that `email.tsx#renderTemplate`
 * adds; the subject is resolved out-of-tree by the `inviteEmail` helper.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { useTranslations } from "next-intl";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";
import { BRAND_NAME } from "@/lib/site";

export type InviteEmailProps = {
  inviterName: string;
  acceptUrl: string;
  role: string;
  teamName?: string | null;
  teamRole?: string | null;
  note?: string | null;
  expiresAt: Date;
};

/** Subject lookup key — resolved by `email.tsx`'s `buildSubject`. */
export const subjectKey = "emails.invite.subject";

/** ICU args for the subject template. `brand` is treated as a value
 *  placeholder, not a translation target — see CLAUDE.md instructions. */
export function subjectArgs(p: InviteEmailProps): Record<string, unknown> {
  return { brand: BRAND_NAME, role: p.role };
}

export default function Invite(props: InviteEmailProps) {
  const t = useTranslations("emails.invite");
  const expiresOn = props.expiresAt.toISOString().slice(0, 10);
  const preview = t("preview", { inviterName: props.inviterName, brand: BRAND_NAME });
  return (
    <EmailLayout preview={preview} title={t("title", { brand: BRAND_NAME })}>
      <P>{t("intro", { inviterName: props.inviterName, brand: BRAND_NAME })}</P>
      <P>
        {t("roleLine", { role: props.role })}
        {props.teamName ? (
          <>
            <br />
            {props.teamRole
              ? t("teamLineWithRole", {
                  teamName: props.teamName,
                  teamRole: props.teamRole,
                })
              : t("teamLine", { teamName: props.teamName })}
          </>
        ) : null}
      </P>
      {props.note ? (
        <P>
          {t("noteHeading", { inviterName: props.inviterName })}{" "}
          <em>&ldquo;{props.note}&rdquo;</em>
        </P>
      ) : null}
      <P>{t("callToAction")}</P>
      <CtaButton href={props.acceptUrl}>{t("ctaButton")}</CtaButton>
      <P style={mutedStyle}>
        {t("expiresOn", { date: expiresOn })}
      </P>
      <P style={mutedStyle}>
        <Link href={props.acceptUrl}>{props.acceptUrl}</Link>
      </P>
    </EmailLayout>
  );
}

export const previewProps: InviteEmailProps = {
  inviterName: "Alex Admin",
  acceptUrl: "https://example.com/invite/accept?token=preview",
  role: "realtor",
  teamName: "Downtown Agency",
  teamRole: "member",
  note: "Looking forward to working with you!",
  expiresAt: new Date(Date.now() + 7 * 86_400_000),
};
