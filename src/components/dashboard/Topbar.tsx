import { IconPlus } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import { TeamSwitcher, type SwitcherTeam } from "./TeamSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { getSession } from "@/lib/auth";
import {
  canCreateAssignment,
  canCreateTeam,
  getUserTeamsForSwitcher,
  hasRole,
} from "@/lib/permissions";
import { initialsFromName } from "@/lib/format";

export async function Topbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const session = await getSession();
  const canCreate = session ? canCreateAssignment(session) : false;
  const canMakeTeam = session ? canCreateTeam(session) : false;

  // Freelancers never see the team switcher (v1 parity), so skip the
  // membership query for them — saves a round-trip per dashboard render.
  let teams: SwitcherTeam[] = [];
  if (session && !hasRole(session, "freelancer")) {
    const memberships = await getUserTeamsForSwitcher(session.user.id);
    teams = memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      logo: m.team.logo || initialsFromName(m.team.name),
      color: m.team.logoColor || "var(--color-ink)",
      city: m.team.city,
      role: m.teamRole,
    }));
  }

  return (
    <header className="hidden md:flex items-center justify-between gap-4 xl:gap-6 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-6 xl:px-8 h-16 sticky top-0 z-40">
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[var(--color-ink)] truncate">{title}</h1>
          {subtitle && <p className="text-xs text-[var(--color-ink-muted)] truncate">{subtitle}</p>}
        </div>
        {teams.length > 0 && (
          <>
            <span className="h-8 w-px bg-[var(--color-border)]" aria-hidden />
            <TeamSwitcher
              teams={teams}
              activeId={session?.activeTeamId ?? null}
              canCreateTeam={canMakeTeam}
            />
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        {canCreate && (
          <Button href="/dashboard/assignments/new" size="sm" className="ml-1.5">
            <IconPlus size={16} />
            New assignment
          </Button>
        )}
      </div>
    </header>
  );
}
