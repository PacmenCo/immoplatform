import Link from "next/link";
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
    href: "/dashboard/settings/integrations/odoo",
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

export default function IntegrationsPage() {
  const connected = INTEGRATIONS.filter((i) => i.connected);
  const available = INTEGRATIONS.filter((i) => !i.connected);
  const totalErrors = INTEGRATIONS.reduce((s, i) => s + (i.errorCount ?? 0), 0);

  return (
    <>
      <Topbar title="Integrations" subtitle={`Connect ${BRAND_NAME} to the rest of your stack`} />

      <div className="p-8 max-w-[1200px]">
        <SettingsNav />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-8">
            {totalErrors > 0 && (
              <div className="flex items-start gap-3 rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] p-4 text-sm">
                <IconAlert size={18} className="mt-0.5 shrink-0 text-[var(--color-asbestos)]" />
                <div className="flex-1">
                  <p className="font-medium text-[var(--color-ink)]">
                    {totalErrors} sync error{totalErrors === 1 ? "" : "s"} across your integrations
                  </p>
                  <p className="mt-0.5 text-[var(--color-ink-soft)]">
                    Some data may be out of date. Review and retry below.
                  </p>
                </div>
                <Button
                  href="/dashboard/settings/integrations/odoo"
                  variant="secondary"
                  size="sm"
                >
                  Review
                </Button>
              </div>
            )}

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                Connected ({connected.length})
              </h2>
              <div className="mt-3 grid gap-3">
                {connected.map((i) => (
                  <IntegrationCard key={i.key} integration={i} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                Available ({available.length})
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
                  About integrations
                </div>
                <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">
                  Org-wide integrations affect everyone on the team. Personal
                  integrations (like your own calendar) only sync your assignments.
                </p>
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}

function IntegrationCard({ integration }: { integration: (typeof INTEGRATIONS)[number] }) {
  const d = integrationDetail[integration.key];
  const hasErrors = (integration.errorCount ?? 0) > 0;
  const href = d.href && integration.connected ? d.href : undefined;

  return (
    <Card className="group relative transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      {href && (
        <Link
          href={href}
          aria-label={`Manage ${integration.name}`}
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
                {integration.scope === "org" ? "Org-wide" : "Personal"}
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
                  {integration.errorCount} error{integration.errorCount === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-[var(--color-epc)]">
                  <IconCheck size={12} />
                  Healthy
                </span>
              )}
              {integration.lastSyncAt && (
                <span className="text-[var(--color-ink-muted)]">
                  Last sync {integration.lastSyncAt}
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
                Connected
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
              Connect
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
