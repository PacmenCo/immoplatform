"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SuccessBanner } from "@/components/ui/SuccessBanner";
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
  return (
    <div className="space-y-6">
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

  const [uploadState, uploadAction, uploading] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundUpload, undefined);
  const [removeState, removeAction, removing] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundRemove, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team logo</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Appears next to the team name on dashboards, assignments, and team cards.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <LogoPreview src={logoUrl} teamName={teamName} />
          <form action={uploadAction} className="flex-1">
            <input
              type="file"
              name="logo"
              accept={TEAM_LOGO_ACCEPT_ATTR}
              className="block w-full max-w-sm text-sm text-[var(--color-ink-soft)] file:mr-3 file:rounded-md file:border file:border-[var(--color-border-strong)] file:bg-[var(--color-bg)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-ink)] hover:file:bg-[var(--color-bg-muted)]"
            />
            <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
              PNG, JPG, WebP or GIF — max {LOGO_MAX_MB} MB.
            </p>
            <div className="mt-3">
              <Button type="submit" variant="secondary" size="sm" loading={uploading}>
                Upload logo
              </Button>
            </div>
          </form>
          {logoUrl && (
            <form action={removeAction}>
              <Button type="submit" variant="ghost" size="sm" loading={removing}>
                Remove
              </Button>
            </form>
          )}
        </div>
        <ActionBanner state={uploadState} successLabel="Logo updated." />
        <ActionBanner state={removeState} successLabel="Logo removed." />
      </CardBody>
    </Card>
  );
}

function LogoPreview({ src, teamName }: { src: string | null; teamName: string }) {
  if (!src) {
    return (
      <div
        aria-hidden
        className="grid h-20 w-20 shrink-0 place-items-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs text-[var(--color-ink-muted)]"
      >
        No logo
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
      alt={`${teamName} logo`}
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

  const [uploadState, uploadAction, uploading] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundUpload, undefined);
  const [removeState, removeAction, removing] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundRemove, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signature image</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Stamped on certificates and signed assignment forms. PNG with a transparent
          background renders cleanest on PDFs.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <SignaturePreview src={signatureUrl} teamName={teamName} />
          <form action={uploadAction} className="flex-1">
            <input
              type="file"
              name="signature"
              accept={TEAM_SIGNATURE_ACCEPT_ATTR}
              className="block w-full max-w-sm text-sm text-[var(--color-ink-soft)] file:mr-3 file:rounded-md file:border file:border-[var(--color-border-strong)] file:bg-[var(--color-bg)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-ink)] hover:file:bg-[var(--color-bg-muted)]"
            />
            <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
              PNG or JPG — max {SIGNATURE_MAX_MB} MB. SVG not supported — PDFs stamp raster.
            </p>
            <div className="mt-3">
              <Button type="submit" variant="secondary" size="sm" loading={uploading}>
                Upload signature
              </Button>
            </div>
          </form>
          {signatureUrl && (
            <form action={removeAction}>
              <Button type="submit" variant="ghost" size="sm" loading={removing}>
                Remove
              </Button>
            </form>
          )}
        </div>
        <ActionBanner state={uploadState} successLabel="Signature updated." />
        <ActionBanner state={removeState} successLabel="Signature removed." />
      </CardBody>
    </Card>
  );
}

function SignaturePreview({ src, teamName }: { src: string | null; teamName: string }) {
  if (!src) {
    return (
      <div
        aria-hidden
        className="grid h-16 w-40 shrink-0 place-items-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs text-[var(--color-ink-muted)]"
      >
        No signature
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={`${teamName} signature`}
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
  if (!state) return null;
  if (!state.ok) return <ErrorAlert>{state.error}</ErrorAlert>;
  return <SuccessBanner>{successLabel}</SuccessBanner>;
}
