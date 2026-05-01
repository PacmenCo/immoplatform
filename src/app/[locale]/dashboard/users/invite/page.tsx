import { Link } from "@/i18n/navigation";
import { TeamRole } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/auth";
import { hasRole, role } from "@/lib/permissions";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconBuilding, IconPlus } from "@/components/ui/Icons";
import { InviteForm } from "./InviteForm";

export default async function InviteUserPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const t = await getTranslations("dashboard.users.invite");
  // v1 parity: invite is admin + realtor-team-owner only. Platform's
  // medewerker (= staff) is excluded from UserController (admin-only) and
  // from team edit (admin + makelaar only), so staff cannot invite anyone.
  const session = await requireRoleOrRedirect(
    ["admin", "realtor"],
    "invite",
  );
  const { teamId: queryTeamId } = await searchParams;

  // Realtors can only invite to teams they OWN. Admins see all teams.
  const isRealtor = hasRole(session, "realtor");
  const where = isRealtor
    ? {
        members: {
          some: { userId: session.user.id, teamRole: TeamRole.owner },
        },
      }
    : undefined;

  const raw = await prisma.team.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      city: true,
      members: {
        where: { teamRole: TeamRole.owner },
        select: {
          user: { select: { firstName: true, lastName: true } },
        },
        take: 1,
      },
    },
  });

  const teams = raw.map((t) => ({
    id: t.id,
    name: t.name,
    city: t.city,
    ownerName: t.members[0]
      ? `${t.members[0].user.firstName} ${t.members[0].user.lastName}`
      : null,
  }));

  // Realtor with zero owned teams cannot invite anyone — show a helpful empty state.
  if (isRealtor && teams.length === 0) {
    return (
      <>
        <Topbar title={t("topbarTitle")} subtitle={t("topbarSubtitle")} />
        <div className="p-8 max-w-[720px]">
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]"
          >
            <Link href="/dashboard/users" className="hover:text-[var(--color-ink)]">
              {t("breadcrumbUsers")}
            </Link>
            <span aria-hidden>/</span>
            <span className="text-[var(--color-ink-soft)]">{t("breadcrumbInvite")}</span>
          </nav>

          <Card>
            <CardBody className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]">
                <IconBuilding size={20} />
              </span>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[var(--color-ink)]">
                  {t("needTeamFirst.title")}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                  {t("needTeamFirst.body")}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button href="/dashboard/teams/new" size="sm">
                    <IconPlus size={14} />
                    {t("needTeamFirst.createTeam")}
                  </Button>
                  <Button href="/dashboard" variant="ghost" size="sm">
                    {t("needTeamFirst.backToDashboard")}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title={t("topbarTitle")} subtitle={t("topbarSubtitle")} />
      <InviteForm
        teams={teams}
        viewerRole={role(session)}
        initialTeamId={queryTeamId ?? null}
      />
    </>
  );
}
