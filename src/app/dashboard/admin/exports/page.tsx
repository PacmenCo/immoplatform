import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import {
  IconList,
  IconChart,
  IconBuilding,
  IconUsers,
  IconArrowRight,
} from "@/components/ui/Icons";

const EXPORTS = [
  {
    id: "assignments",
    icon: IconList,
    title: "Assignments CSV",
    description: "All assignments with status, services, owner, team and dates.",
    rows: "~ 1,284 rows",
    accent: "var(--color-brand)",
  },
  {
    id: "payouts",
    icon: IconChart,
    title: "Commission payouts",
    description: "Per-team payouts with gross, commission share and net amounts.",
    rows: "~ 112 rows",
    accent: "var(--color-epc)",
  },
  {
    id: "teams",
    icon: IconBuilding,
    title: "Teams",
    description: "Team directory with legal names, VAT and billing details.",
    rows: "6 rows",
    accent: "var(--color-fuel)",
  },
  {
    id: "users",
    icon: IconUsers,
    title: "Users",
    description: "All platform users with role, team and last-seen timestamp.",
    rows: "28 rows",
    accent: "var(--color-electrical)",
  },
  {
    id: "activity",
    icon: IconArrowRight,
    title: "Activity log",
    description: "Full audit trail including logins, mutations and status changes.",
    rows: "~ 18,450 rows",
    accent: "var(--color-asbestos)",
  },
];

export default function ExportsPage() {
  return (
    <>
      <Topbar title="Data exports" subtitle="Download CSV snapshots for accounting and analytics" />

      <div className="p-8 max-w-[1400px] space-y-6">
        <div className="max-w-2xl">
          <p className="text-sm text-[var(--color-ink-soft)]">Exports are generated on demand using the date range you provide. Large exports are emailed to <span className="font-medium">jordan@asbestexperts.be</span> when ready.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {EXPORTS.map((e) => (
            <Card key={e.id} className="flex h-full flex-col">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-md"
                    style={{ backgroundColor: `color-mix(in srgb, ${e.accent} 14%, white)`, color: e.accent }}
                  >
                    <e.icon size={18} />
                  </span>
                  <div>
                    <CardTitle>{e.title}</CardTitle>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{e.rows}</p>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="flex flex-1 flex-col gap-4">
                <p className="text-sm text-[var(--color-ink-soft)]">{e.description}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="From" id={`${e.id}-from`}>
                    <Input id={`${e.id}-from`} type="date" defaultValue="2026-01-01" />
                  </Field>
                  <Field label="To" id={`${e.id}-to`}>
                    <Input id={`${e.id}-to`} type="date" defaultValue="2026-04-18" />
                  </Field>
                </div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-xs text-[var(--color-ink-muted)]">CSV · UTF-8</span>
                  <Button size="sm">Export</Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
