import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { InviteForm } from "./InviteForm";

export default async function InviteUserPage() {
  await requireRole(["admin", "staff", "realtor"]);

  const raw = await prisma.team.findMany({
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

  return <InviteForm teams={teams} />;
}
