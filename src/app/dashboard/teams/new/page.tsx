import { redirect } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { TeamForm } from "@/components/dashboard/TeamForm";
import { requireSession } from "@/lib/auth";
import { canCreateTeam } from "@/lib/permissions";
import { createTeam } from "@/app/actions/teams";

export default async function NewTeamPage() {
  const session = await requireSession();
  if (!canCreateTeam(session)) {
    redirect("/no-access?section=teams");
  }

  return (
    <>
      <Topbar
        title="Create team"
        subtitle="Start a new agency office. You'll become its owner."
      />
      {/* canCreateTeam is admin-only (commit d17c030), so anyone on this
          page is admin — pass isAdmin to unlock the Commission accordion. */}
      <TeamForm action={createTeam} cancelHref="/dashboard/teams" isAdmin />
    </>
  );
}
