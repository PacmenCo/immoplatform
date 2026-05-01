import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
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

  const tIntg = await getTranslations("dashboard.settings.integrations");
  const tTop = await getTranslations(
    "dashboard.settings.integrations.outlook.topbar",
  );
  const tO = await getTranslations("dashboard.settings.integrations.outlook");
  const tPersonal = await getTranslations(
    "dashboard.settings.integrations.outlook.personal",
  );

  const ready = isOutlookConfigured();
  const account = ready
    ? await prisma.calendarAccount.findUnique({
        where: { userId_provider: { userId: session.user.id, provider: "outlook" } },
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
          <span className="text-[var(--color-ink-soft)]">{tO("breadcrumb")}</span>
        </nav>

        {params.connected === "1" && (
          <p
            role="status"
            className="rounded-md border border-[var(--color-epc)]/30 bg-[color-mix(in_srgb,var(--color-epc)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-ink-soft)]"
          >
            <IconCheck size={14} className="mr-1 inline" />
            {tO("connectSuccess")}
          </p>
        )}
        {params.error && (
          <p
            role="alert"
            className="rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-asbestos)]"
          >
            {tO("connectError", { code: params.error })}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{tPersonal("title")}</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              {tPersonal("subtitle")}
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            {!ready ? (
              <p className="text-sm text-[var(--color-ink-muted)]">
                {tPersonal.rich("notConfigured", {
                  var1: () => <code className="font-mono">OUTLOOK_OAUTH_CLIENT_ID</code>,
                  var2: () => <code className="font-mono">OUTLOOK_OAUTH_CLIENT_SECRET</code>,
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
                <DisconnectButton provider="outlook" />
              </>
            ) : account?.disconnectedAt ? (
              <>
                <p className="text-sm text-[var(--color-ink-soft)]">
                  {tPersonal("expired", {
                    date: account.disconnectedAt.toISOString().slice(0, 10),
                  })}
                </p>
                <Button href="/api/oauth/outlook/initiate" size="sm">
                  {tPersonal("reconnect")}
                </Button>
              </>
            ) : (
              <Button href="/api/oauth/outlook/initiate" size="sm">
                {tPersonal("connect")}
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
