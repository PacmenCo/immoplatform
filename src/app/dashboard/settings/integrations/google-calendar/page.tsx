import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconCheck } from "@/components/ui/Icons";
import { requireRoleOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isGoogleAgencyConfigured,
  isGooglePersonalConfigured,
} from "@/lib/calendar/config";
import { DisconnectButton } from "../DisconnectButton";

type SearchParams = Promise<{ connected?: string; error?: string }>;

export default async function GoogleCalendarSettings({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // v1 parity: personal calendar OAuth is admin+medewerker only.
  const session = await requireRoleOrRedirect(["admin", "staff"], "admin");
  const params = await searchParams;

  const agencyReady = isGoogleAgencyConfigured();
  const personalReady = isGooglePersonalConfigured();

  const account = personalReady
    ? await prisma.calendarAccount.findUnique({
        where: { userId_provider: { userId: session.user.id, provider: "google" } },
      })
    : null;

  const connected = account && !account.disconnectedAt;

  return (
    <>
      <Topbar title="Google Calendar" subtitle="Two independent integrations — agency shared calendar and your personal one." />
      <div className="p-8 max-w-[900px] space-y-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          <Link href="/dashboard/settings/integrations" className="hover:text-[var(--color-ink)]">
            Integrations
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[var(--color-ink-soft)]">Google Calendar</span>
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
            <CardTitle>Agency shared calendar</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Every scheduled assignment is pushed to a single Google calendar via a service
              account. Subscribe to it from your own Google to see the agency pipeline.
            </p>
          </CardHeader>
          <CardBody>
            {agencyReady ? (
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
                <p className="font-medium text-[var(--color-ink)]">
                  <IconCheck size={14} className="mr-1 inline text-[var(--color-epc)]" />
                  Sync is active.
                </p>
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                  Calendar id:{" "}
                  <code className="font-mono text-[var(--color-ink)]">
                    {process.env.GOOGLE_AGENCY_CALENDAR_ID}
                  </code>
                </p>
                <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                  To view it personally: open Google Calendar → &ldquo;Other calendars&rdquo; → &ldquo;+&rdquo;
                  → Subscribe to calendar → paste the id above. Or ask an admin to share it
                  with your Google account directly.
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] p-4 text-sm">
                <p className="font-medium text-[var(--color-ink)]">Not configured</p>
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                  An admin needs to set <code className="font-mono">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>,{" "}
                  <code className="font-mono">GOOGLE_SERVICE_ACCOUNT_KEY</code>, and{" "}
                  <code className="font-mono">GOOGLE_AGENCY_CALENDAR_ID</code> in the server
                  environment, then share the target calendar with the service-account email
                  as &ldquo;Make changes to events&rdquo;.
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Google calendar</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Connect your personal Google account so you can click &ldquo;Add to my calendar&rdquo; on an
              assignment and have the event land on your own schedule.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            {!personalReady ? (
              <p className="text-sm text-[var(--color-ink-muted)]">
                Not configured — an admin needs to set{" "}
                <code className="font-mono">GOOGLE_OAUTH_CLIENT_ID</code> +{" "}
                <code className="font-mono">GOOGLE_OAUTH_CLIENT_SECRET</code>.
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
                <DisconnectButton provider="google" />
              </>
            ) : account?.disconnectedAt ? (
              <>
                <p className="text-sm text-[var(--color-ink-soft)]">
                  Your connection expired or was revoked on{" "}
                  {account.disconnectedAt.toISOString().slice(0, 10)}. Reconnect to keep the
                  &ldquo;Add to my calendar&rdquo; button working.
                </p>
                <Button href="/api/oauth/google/initiate" size="sm">
                  Reconnect Google
                </Button>
              </>
            ) : (
              <Button href="/api/oauth/google/initiate" size="sm">
                Connect my Google calendar
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
