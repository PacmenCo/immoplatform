import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconPlus, IconArrowRight } from "@/components/ui/Icons";
import { requireRoleOrRedirect } from "@/lib/auth";
import { SettingsNav } from "../_nav";
import { SettingsScopeBanner } from "@/components/dashboard/SettingsScopeBanner";
import { BrandName } from "@/components/BrandName";

const KEYS = [
  {
    id: "k_1",
    name: "Production — CRM sync",
    prefix: "immo_live_sk_",
    mask: "··················8f2a",
    created: "2026-02-14",
    lastUsed: "3 min ago",
  },
  {
    id: "k_2",
    name: "Staging — webhook replay",
    prefix: "immo_test_sk_",
    mask: "··················c1d0",
    created: "2026-01-20",
    lastUsed: "2 days ago",
  },
  {
    id: "k_3",
    name: "Zapier integration",
    prefix: "immo_live_sk_",
    mask: "··················4417",
    created: "2025-11-05",
    lastUsed: "Never",
  },
];

export default async function ApiSettingsPage() {
  await requireRoleOrRedirect(["admin", "staff"], "admin");

  return (
    <>
      <Topbar title="API keys" subtitle="Programmatic access to your workspace" />

      <div className="p-8 max-w-[960px]">
        <SettingsNav />
        <div className="mt-6 space-y-8">
          <SettingsScopeBanner scope="org" />
        <a
          href="#"
          className="group flex items-center justify-between gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-5 py-4 transition-colors hover:border-[var(--color-border-strong)]"
        >
          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">
              Read the API documentation
            </p>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Endpoints, auth, rate limits and client libraries.
            </p>
          </div>
          <IconArrowRight
            size={16}
            className="text-[var(--color-ink-muted)] transition-transform group-hover:translate-x-1"
          />
        </a>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Active keys</CardTitle>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                  Keys can be used to authenticate requests to the <BrandName /> API. Treat them like passwords.
                </p>
              </div>
              <Button variant="primary" size="sm">
                <IconPlus size={14} />
                Create new key
              </Button>
            </div>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Key</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3">Last used</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {KEYS.map((k) => (
                  <tr
                    key={k.id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-alt)]"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--color-ink)]">{k.name}</span>
                        {k.prefix.includes("test") && <Badge>test</Badge>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="rounded bg-[var(--color-bg-muted)] px-2 py-1 font-mono text-xs text-[var(--color-ink-soft)]">
                        {k.prefix}
                        {k.mask}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-[var(--color-ink-soft)]">{k.created}</td>
                    <td className="px-6 py-4 text-[var(--color-ink-soft)]">{k.lastUsed}</td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm">Revoke</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook endpoint</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Receive assignment events pushed in real time.
            </p>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <code className="rounded bg-[var(--color-bg-muted)] px-3 py-2 font-mono text-xs text-[var(--color-ink-soft)]">
                Not configured
              </code>
              <Button variant="secondary" size="sm">Configure webhook</Button>
            </div>
          </CardBody>
        </Card>
        </div>
      </div>
    </>
  );
}
