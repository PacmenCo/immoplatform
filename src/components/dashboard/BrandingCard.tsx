"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SuccessBanner } from "@/components/ui/SuccessBanner";
import { useTranslateError } from "@/i18n/error";
import {
  uploadTeamLogo,
  removeTeamLogo,
  uploadTeamSignature,
  removeTeamSignature,
} from "@/app/actions/teamBranding";
import {
  TEAM_LOGO_ACCEPT_ATTR,
  TEAM_LOGO_MAX_BYTES,
  TEAM_SIGNATURE_ACCEPT_ATTR,
  TEAM_SIGNATURE_MAX_BYTES,
} from "@/lib/teamBranding";
import type { ActionResult } from "@/app/actions/_types";

type Props = {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  signatureUrl: string | null;
};

const LOGO_MAX_MB = Math.round(TEAM_LOGO_MAX_BYTES / (1024 * 1024));
const SIGNATURE_MAX_MB = Math.round(TEAM_SIGNATURE_MAX_BYTES / (1024 * 1024));

export function BrandingCard({ teamId, teamName, logoUrl, signatureUrl }: Props) {
  // `@container` lets inner sections reflow based on this card's width
  // (e.g. narrow when stacked into a side panel) rather than the viewport.
  return (
    <div className="@container space-y-6">
      <LogoSection teamId={teamId} teamName={teamName} logoUrl={logoUrl} />
      <SignatureSection teamId={teamId} teamName={teamName} signatureUrl={signatureUrl} />
    </div>
  );
}

// ─── Logo ──────────────────────────────────────────────────────────

function LogoSection({
  teamId,
  teamName,
  logoUrl,
}: {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
}) {
  const boundUpload = uploadTeamLogo.bind(null, teamId);
  const boundRemove = async () => removeTeamLogo(teamId);
  const t = useTranslations("dashboard.shared.brandingCard");
  const tCommon = useTranslations("dashboard.shared.common");

  const [uploadState, uploadAction, uploading] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundUpload, undefined);
  const [removeState, removeAction, removing] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundRemove, undefined);
  const uploadFormRef = useRef<HTMLFormElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("logoTitle")}</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {t("logoDescription")}
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-4 @md:flex-row @md:items-start">
          <LogoPreview src={logoUrl} teamName={teamName} />
          <form ref={uploadFormRef} action={uploadAction} className="flex-1">
            <input
              type="file"
              name="logo"
              accept={TEAM_LOGO_ACCEPT_ATTR}
              disabled={uploading}
              onChange={(e) => {
                if (e.currentTarget.files && e.currentTarget.files.length > 0) {
                  uploadFormRef.current?.requestSubmit();
                }
              }}
              className="block w-full max-w-sm text-sm text-[var(--color-ink-soft)] file:mr-3 file:rounded-md file:border file:border-[var(--color-border-strong)] file:bg-[var(--color-bg)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-ink)] hover:file:bg-[var(--color-bg-muted)] disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-2 text-xs text-[var(--color-ink-muted)]" aria-live="polite">
              {uploading
                ? tCommon("uploading")
                : t("logoConstraints", { max: LOGO_MAX_MB })}
            </p>
          </form>
          {logoUrl && (
            <form action={removeAction}>
              <Button type="submit" variant="ghost" size="sm" loading={removing}>
                {t("remove")}
              </Button>
            </form>
          )}
        </div>
        <ActionBanner state={uploadState} successLabel={t("logoUpdated")} />
        <ActionBanner state={removeState} successLabel={t("logoRemoved")} />
      </CardBody>
    </Card>
  );
}

function LogoPreview({ src, teamName }: { src: string | null; teamName: string }) {
  const t = useTranslations("dashboard.shared.brandingCard");
  if (!src) {
    return (
      <div
        aria-hidden
        className="grid h-20 w-20 shrink-0 place-items-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs text-[var(--color-ink-muted)]"
      >
        {t("logoNoneAlt")}
      </div>
    );
  }
  // Intentionally using <img> not next/image — the URL comes from our own
  // /api/teams route which may 302 to a DO Spaces presigned URL; next/image's
  // loader can't follow that cross-origin redirect without config. Plain
  // <img> handles the redirect transparently.
  return (
    <img
      src={src}
      alt={t("logoAlt", { teamName })}
      className="h-20 w-20 shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] object-contain p-1"
    />
  );
}

// ─── Signature ─────────────────────────────────────────────────────

function SignatureSection({
  teamId,
  teamName,
  signatureUrl,
}: {
  teamId: string;
  teamName: string;
  signatureUrl: string | null;
}) {
  const boundUpload = uploadTeamSignature.bind(null, teamId);
  const boundRemove = async () => removeTeamSignature(teamId);
  const t = useTranslations("dashboard.shared.brandingCard");
  const tCommon = useTranslations("dashboard.shared.common");

  const [uploadState, uploadAction, uploading] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundUpload, undefined);
  const [removeState, removeAction, removing] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundRemove, undefined);
  const uploadFormRef = useRef<HTMLFormElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signatureTitle")}</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {t("signatureDescription")}
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-4 @md:flex-row @md:items-start">
          <SignaturePreview src={signatureUrl} teamName={teamName} />
          <form ref={uploadFormRef} action={uploadAction} className="flex-1">
            <input
              type="file"
              name="signature"
              accept={TEAM_SIGNATURE_ACCEPT_ATTR}
              disabled={uploading}
              onChange={(e) => {
                if (e.currentTarget.files && e.currentTarget.files.length > 0) {
                  uploadFormRef.current?.requestSubmit();
                }
              }}
              className="block w-full max-w-sm text-sm text-[var(--color-ink-soft)] file:mr-3 file:rounded-md file:border file:border-[var(--color-border-strong)] file:bg-[var(--color-bg)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-ink)] hover:file:bg-[var(--color-bg-muted)] disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-2 text-xs text-[var(--color-ink-muted)]" aria-live="polite">
              {uploading
                ? tCommon("uploading")
                : t("signatureConstraints", { max: SIGNATURE_MAX_MB })}
            </p>
          </form>
          {signatureUrl && (
            <form action={removeAction}>
              <Button type="submit" variant="ghost" size="sm" loading={removing}>
                {t("remove")}
              </Button>
            </form>
          )}
        </div>
        <ActionBanner state={uploadState} successLabel={t("signatureUpdated")} />
        <ActionBanner state={removeState} successLabel={t("signatureRemoved")} />
      </CardBody>
    </Card>
  );
}

function SignaturePreview({ src, teamName }: { src: string | null; teamName: string }) {
  const t = useTranslations("dashboard.shared.brandingCard");
  if (!src) {
    return (
      <div
        aria-hidden
        className="grid h-16 w-40 shrink-0 place-items-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs text-[var(--color-ink-muted)]"
      >
        {t("signatureNoneAlt")}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={t("signatureAlt", { teamName })}
      className="h-16 w-40 shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] object-contain p-1"
    />
  );
}

// ─── Shared status banner ──────────────────────────────────────────

function ActionBanner({
  state,
  successLabel,
}: {
  state: ActionResult | undefined;
  successLabel: string;
}) {
  const tErr = useTranslateError();
  if (!state) return null;
  if (!state.ok) return <ErrorAlert>{tErr(state.error)}</ErrorAlert>;
  return <SuccessBanner>{successLabel}</SuccessBanner>;
}
