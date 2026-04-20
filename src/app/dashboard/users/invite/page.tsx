import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconBuilding, IconPlus } from "@/components/ui/Icons";
import { InviteForm } from "./InviteForm";

export default async function InviteUserPage() {
  const session = await requireRole(["admin", "staff", "realtor"]);

  // Realtors can only invite to teams they OWN. Admins + staff see all teams.
  const isRealtor = hasRole(session, "realtor");
  const where = isRealtor
    ? {
        members: {
          some: { userId: session.user.id, teamRole: "owner" },
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
        where: { teamRole: "owner" },
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
        <Topbar title="Invite user" subtitle="Send an email invite to join your workspace" />
        <div className="p-8 max-w-[720px]">
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]"
          >
            <Link href="/dashboard/users" className="hover:text-[var(--color-ink)]">
              Users
            </Link>
            <span aria-hidden>/</span>
            <span className="text-[var(--color-ink-soft)]">Invite</span>
          </nav>

          <Card>
            <CardBody className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]">
                <IconBuilding size={20} />
              </span>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[var(--color-ink)]">
                  You need to own a team before you can invite anyone
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                  Realtors can only invite people into teams they own. You&apos;re not an
                  owner of any team yet — ask your agency admin to transfer ownership to
                  you, or create a new team.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button href="/dashboard/teams/new" size="sm">
                    <IconPlus size={14} />
                    Create a team
                  </Button>
                  <Button href="/dashboard" variant="ghost" size="sm">
                    Back to dashboard
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
      <Topbar title="Invite user" subtitle="Send an email invite to join your workspace" />
      <InviteForm teams={teams} />
    </>
  );
}
