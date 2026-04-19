import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { IconPlus, IconBuilding, IconUsers } from "@/components/ui/Icons";
import { TEAMS } from "@/lib/mockData";

export default function TeamsPage() {
  return (
    <>
      <Topbar title="Teams" subtitle={`${TEAMS.length} offices`} />

      <div className="p-8 max-w-[1400px]">
        <div className="mb-6 flex items-center justify-end">
          <Button size="sm">
            <IconPlus size={14} />
            New team
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEAMS.map((team) => (
            <Card
              key={team.id}
              className="group relative p-6 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
            >
              <div className="flex items-start gap-4">
                <Avatar initials={team.logo} size="lg" color={team.color} />
                <div className="min-w-0 flex-1">
                  <Link
                    href="#"
                    className="font-semibold text-[var(--color-ink)] hover:underline"
                  >
                    {team.name}
                  </Link>
                  <p className="text-sm text-[var(--color-ink-muted)]">{team.city}</p>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-4">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Members
                  </dt>
                  <dd className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-ink)]">
                    <IconUsers size={14} className="text-[var(--color-ink-muted)]" />
                    {team.members}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Active
                  </dt>
                  <dd className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-ink)]">
                    <IconBuilding size={14} className="text-[var(--color-ink-muted)]" />
                    {team.active}
                  </dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
