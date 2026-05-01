import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  IconAlert,
  IconCheck,
  IconArrowRight,
  IconPlug,
} from "@/components/ui/Icons";
import { INTEGRATIONS } from "@/lib/mockData";
import { SettingsNav } from "../_nav";
import { BRAND_NAME } from "@/lib/site";

const integrationDetail: Record<
  string,
  { href?: string; accent: string; logoBg: string; logoInk: string; logo: string }
> = {
  google_calendar: {
    href: "/dashboard/settings/integrations/google-calendar",
    accent: "#1a73e8",
    logoBg: "#e8f0fe",
    logoInk: "#1a73e8",
    logo: "G",
  },
  outlook_calendar: {
    href: "/dashboard/settings/integrations/outlook-calendar",
    accent: "#0078d4",
    logoBg: "#deecf9",
    logoInk: "#0078d4",
    logo: "O",
  },
  odoo: {
    accent: "#714b67",
    logoBg: "#f3e8fd",
    logoInk: "#714b67",
    logo: "OD",
  },
  email_provider: {
    accent: "#ffde59",
    logoBg: "#fff8cc",
    logoInk: "#7c6a00",
    logo: "✉",
  },
  eenvoudig_factureren: {
    accent: "#0ea5e9",
    logoBg: "#e0f2fe",
    logoInk: "#0369a1",
    logo: "EF",
  },
};

export default async function IntegrationsPage() {
  const t = await getTranslations("dashboard.settings.integrations");
  const tTop = await getTranslations("dashboard.settings.integrations.topbar");
  const connected = INTEGRATIONS.filter((i) => i.connected);
  const available = INTEGRATIONS.filter((i) => !i.connected);
  const totalErrors = INTEGRATIONS.reduce((s, i) => s + (i.errorCount ?? 0), 0);

  return (
    <>
      <Topbar
        title={tTop("title")}
        subtitle={tTop("subtitle", { brand: BRAND_NAME })}
      />

      <div className="p-8 max-w-[1200px]">
        <SettingsNav />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-8">
            {totalErrors > 0 && (
              <div className="flex items-start gap-3 rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] p-4 text-sm">
                <IconAlert size={18} className="mt-0.5 shrink-0 text-[var(--color-asbestos)]" />
                <div className="flex-1">
                  <p className="font-medium text-[var(--color-ink)]">
                    {t("errors", { count: totalErrors })}
                  </p>
                  <p className="mt-0.5 text-[var(--color-ink-soft)]">
                    {t("errorsBody")}
                  </p>
                </div>
              </div>
            )}

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                {t("connectedHeading", { count: connected.length })}
              </h2>
              <div className="mt-3 grid gap-3">
                {connected.map((i) => (
                  <IntegrationCard key={i.key} integration={i} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                {t("availableHeading", { count: available.length })}
              </h2>
              <div className="mt-3 grid gap-3">
                {available.map((i) => (
                  <IntegrationCard key={i.key} integration={i} />
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                  <IconPlug size={16} />
                  {t("aboutTitle")}
                </div>
                <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">
                  {t("aboutBody")}
                </p>
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}

async function IntegrationCard({
  integration,
}: {
  integration: (typeof INTEGRATIONS)[number];
}) {
  const t = await getTranslations("dashboard.settings.integrations");
  const d = integrationDetail[integration.key];
  const hasErrors = (integration.errorCount ?? 0) > 0;
  const href = d.href && integration.connected ? d.href : undefined;

  return (
    <Card className="group relative transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      {href && (
        <Link
          href={href}
          aria-label={t("manageAria", { name: integration.name })}
          className="absolute inset-0 z-10 rounded-[var(--radius-lg)]"
        />
      )}
      <CardBody className="relative flex items-center gap-4">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-sm font-bold"
          style={{ backgroundColor: d.logoBg, color: d.logoInk }}
        >
          {d.logo}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[var(--color-ink)] group-hover:underline">
              {integration.name}
            </p>
            <span className="text-xs text-[var(--color-ink-muted)]">
              · {integration.vendor}
            </span>
            {integration.scope && (
              <Badge
                bg={integration.scope === "org" ? "#f5f3ff" : "#eff6ff"}
                fg={integration.scope === "org" ? "#6d28d9" : "#1d4ed8"}
                size="sm"
              >
                {integration.scope === "org" ? t("scopeOrg") : t("scopePersonal")}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {integration.description}
          </p>
          {integration.connected && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              {hasErrors ? (
                <span className="inline-flex items-center gap-1 font-medium text-[var(--color-asbestos)]">
                  <IconAlert size={12} />
                  {t("errorCount", { count: integration.errorCount ?? 0 })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-[var(--color-epc)]">
                  <IconCheck size={12} />
                  {t("healthy")}
                </span>
              )}
              {integration.lastSyncAt && (
                <span className="text-[var(--color-ink-muted)]">
                  {t("lastSync", { when: integration.lastSyncAt })}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="relative flex shrink-0 items-center gap-2">
          {integration.connected ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-epc)_14%,var(--color-bg))] px-2.5 py-0.5 text-xs font-medium text-[var(--color-epc)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-epc)]" />
                {t("connected")}
              </span>
              {href && (
                <IconArrowRight
                  size={16}
                  className="text-[var(--color-ink-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-ink-soft)]"
                />
              )}
            </>
          ) : (
            <Button variant="secondary" size="sm" className="relative">
              {t("connect")}
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
