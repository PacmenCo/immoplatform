import { getTranslations } from "next-intl/server";
import { localeRedirect } from "@/i18n/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { TeamForm } from "@/components/dashboard/TeamForm";
import { requireSession } from "@/lib/auth";
import { canCreateFirstTeam, canCreateTeam, hasRole } from "@/lib/permissions";
import { createTeam } from "@/app/actions/teams";

export default async function NewTeamPage() {
  const t = await getTranslations("dashboard.teams.new");
  const session = await requireSession();
  // Mirror the action-layer gate: admin can always create; realtors get a
  // one-shot founder grant via `canCreateFirstTeam` when they own zero teams.
  // Both gates collapse to the same OR — keep them in sync.
  const allowed =
    canCreateTeam(session) || (await canCreateFirstTeam(session));
  if (!allowed) {
    await localeRedirect("/no-access?section=teams");
  }

  return (
    <>
      <Topbar
        title={t("topbarTitle")}
        subtitle={t("topbarSubtitle")}
      />
      {/* Commission accordion is admin-only — realtor founders shouldn't be
          dictating their own commission rate. The accordion remains hidden;
          admin can configure it after the team is created. */}
      <TeamForm
        action={createTeam}
        cancelHref="/dashboard/teams"
        isAdmin={hasRole(session, "admin")}
      />
    </>
  );
}
