import { Topbar } from "@/components/dashboard/Topbar";
import { prisma } from "@/lib/db";
import { AssignmentForm } from "@/components/dashboard/AssignmentForm";
import { createAssignment } from "@/app/actions/assignments";
import { requireSession } from "@/lib/auth";
import {
  canReassignFreelancer,
  canSetDiscount,
  eligibleFreelancerWhere,
} from "@/lib/permissions";

export default async function NewAssignmentPage() {
  const session = await requireSession();
  const canFreelancer = canReassignFreelancer(session);

  const [services, freelancers] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { key: "asc" } }),
    canFreelancer
      ? prisma.user.findMany({
          where: eligibleFreelancerWhere(),
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          take: 500,
          select: { id: true, firstName: true, lastName: true, region: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <Topbar title="New assignment" subtitle="Create a new property inspection" />
      <AssignmentForm
        services={services}
        action={createAssignment}
        cancelHref="/dashboard/assignments"
        canSetDiscount={canSetDiscount(session)}
        canSetFreelancer={canFreelancer}
        freelancers={freelancers}
      />
    </>
  );
}
