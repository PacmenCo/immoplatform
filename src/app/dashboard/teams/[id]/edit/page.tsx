import { notFound } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { TeamForm, type TeamFormInitial } from "@/components/dashboard/TeamForm";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canEditTeam } from "@/lib/permissions";
import { updateTeam } from "@/app/actions/teams";

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  if (!(await canEditTeam(session, id))) notFound();

  const team = await prisma.team.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      city: true,
      email: true,
      description: true,
      logo: true,
      logoColor: true,
      legalName: true,
      vatNumber: true,
      kboNumber: true,
      iban: true,
      billingEmail: true,
      billingPhone: true,
      billingAddress: true,
      billingPostal: true,
      billingCity: true,
      billingCountry: true,
      commissionType: true,
      commissionValue: true,
    },
  });
  if (!team) notFound();

  const initial: TeamFormInitial = team;
  const boundUpdate = updateTeam.bind(null, id);

  return (
    <>
      <Topbar
        title={`Edit ${team.name}`}
        subtitle="Update agency details, billing info, and commission config."
      />
      <TeamForm
        action={boundUpdate}
        initial={initial}
        cancelHref={`/dashboard/teams/${id}`}
      />
    </>
  );
}
