import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconCheck } from "@/components/ui/Icons";
import { requireRoleOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOutlookConfigured } from "@/lib/calendar/config";
import { DisconnectButton } from "../DisconnectButton";

type SearchParams = Promise<{ connected?: string; error?: string }>;

export default async function OutlookCalendarSettings({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // v1 parity: personal calendar OAuth is admin+medewerker only.
  const session = await requireRoleOrRedirect(["admin", "staff"], "admin");
  const params = await searchParams;

  const ready = isOutlookConfigured();
  const account = ready
    ? await prisma.calendarAccount.findUnique({
        where: { userId_provider: { userId: session.user.id, provider: "outlook" } },
      })
    : null;
  const connected = account && !account.disconnectedAt;

  return (
    <>
      <Topbar title="Outlook / Microsoft 365" subtitle="Sync the assignments you create to your own Outlook calendar." />
      <div className="p-8 max-w-[900px] space-y-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          <Link href="/dashboard/settings/integrations" className="hover:text-[var(--color-ink)]">
            Integrations
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[var(--color-ink-soft)]">Outlook</span>
        </nav>

        {params.connected === "1" && (
          <p
            role="status"
            className="rounded-md border border-[var(--color-epc)]/30 bg-[color-mix(in_srgb,var(--color-epc)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-ink-soft)]"
          >
            <IconCheck size={14} className="mr-1 inline" />
            Connected successfully.
          </p>
        )}
        {params.error && (
          <p
            role="alert"
            className="rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-asbestos)]"
          >
            Could not complete the connection ({params.error}). Try again.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>My Outlook calendar</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              When you create an assignment, we push it to your personal Outlook calendar and
              keep it in sync with reschedules and cancellations. Nothing syncs until you connect.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            {!ready ? (
              <p className="text-sm text-[var(--color-ink-muted)]">
                Not configured — an admin needs to set{" "}
                <code className="font-mono">OUTLOOK_OAUTH_CLIENT_ID</code> +{" "}
                <code className="font-mono">OUTLOOK_OAUTH_CLIENT_SECRET</code> in the server
                environment after registering an app in Azure.
              </p>
            ) : connected ? (
              <>
                <p className="text-sm text-[var(--color-ink)]">
                  Connected as{" "}
                  <strong className="font-medium">{account!.providerAccountEmail}</strong>
                </p>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Connected on {account!.createdAt.toISOString().slice(0, 10)}.
                </p>
                <DisconnectButton provider="outlook" />
              </>
            ) : account?.disconnectedAt ? (
              <>
                <p className="text-sm text-[var(--color-ink-soft)]">
                  Your connection expired or was revoked on{" "}
                  {account.disconnectedAt.toISOString().slice(0, 10)}. Reconnect so new
                  assignments land on your Outlook again.
                </p>
                <Button href="/api/oauth/outlook/initiate" size="sm">
                  Reconnect Microsoft account
                </Button>
              </>
            ) : (
              <Button href="/api/oauth/outlook/initiate" size="sm">
                Connect Microsoft account
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
