import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
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

  const tIntg = await getTranslations("dashboard.settings.integrations");
  const tTop = await getTranslations(
    "dashboard.settings.integrations.google.topbar",
  );
  const tG = await getTranslations("dashboard.settings.integrations.google");
  const tAgency = await getTranslations(
    "dashboard.settings.integrations.google.agency",
  );
  const tPersonal = await getTranslations(
    "dashboard.settings.integrations.google.personal",
  );

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
      <Topbar title={tTop("title")} subtitle={tTop("subtitle")} />
      <div className="p-8 max-w-[900px] space-y-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          <Link href="/dashboard/settings/integrations" className="hover:text-[var(--color-ink)]">
            {tIntg("breadcrumb")}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[var(--color-ink-soft)]">{tG("breadcrumb")}</span>
        </nav>

        {params.connected === "1" && (
          <p
            role="status"
            className="rounded-md border border-[var(--color-epc)]/30 bg-[color-mix(in_srgb,var(--color-epc)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-ink-soft)]"
          >
            <IconCheck size={14} className="mr-1 inline" />
            {tG("connectSuccess")}
          </p>
        )}
        {params.error && (
          <p
            role="alert"
            className="rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-asbestos)]"
          >
            {tG("connectError", { code: params.error })}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{tAgency("title")}</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              {tAgency("subtitle")}
            </p>
          </CardHeader>
          <CardBody>
            {agencyReady ? (
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
                <p className="font-medium text-[var(--color-ink)]">
                  <IconCheck size={14} className="mr-1 inline text-[var(--color-epc)]" />
                  {tAgency("active")}
                </p>
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                  {tAgency("calendarIdLabel")}{" "}
                  <code className="font-mono text-[var(--color-ink)]">
                    {process.env.GOOGLE_AGENCY_CALENDAR_ID}
                  </code>
                </p>
                <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                  {tAgency("howTo")}
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] p-4 text-sm">
                <p className="font-medium text-[var(--color-ink)]">{tAgency("notConfigured")}</p>
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                  {tAgency.rich("notConfiguredBody", {
                    var1: () => <code className="font-mono">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>,
                    var2: () => <code className="font-mono">GOOGLE_SERVICE_ACCOUNT_KEY</code>,
                    var3: () => <code className="font-mono">GOOGLE_AGENCY_CALENDAR_ID</code>,
                  })}
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tPersonal("title")}</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              {tPersonal("subtitle")}
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            {!personalReady ? (
              <p className="text-sm text-[var(--color-ink-muted)]">
                {tPersonal.rich("notConfigured", {
                  var1: () => <code className="font-mono">GOOGLE_OAUTH_CLIENT_ID</code>,
                  var2: () => <code className="font-mono">GOOGLE_OAUTH_CLIENT_SECRET</code>,
                })}
              </p>
            ) : connected ? (
              <>
                <p className="text-sm text-[var(--color-ink)]">
                  {tPersonal("connectedAsPrefix")}
                  <strong className="font-medium">{account!.providerAccountEmail}</strong>
                </p>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  {tPersonal("connectedOn", { date: account!.createdAt.toISOString().slice(0, 10) })}
                </p>
                <DisconnectButton provider="google" />
              </>
            ) : account?.disconnectedAt ? (
              <>
                <p className="text-sm text-[var(--color-ink-soft)]">
                  {tPersonal("expired", {
                    date: account.disconnectedAt.toISOString().slice(0, 10),
                  })}
                </p>
                <Button href="/api/oauth/google/initiate" size="sm">
                  {tPersonal("reconnect")}
                </Button>
              </>
            ) : (
              <Button href="/api/oauth/google/initiate" size="sm">
                {tPersonal("connect")}
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
