import { Topbar } from "@/components/dashboard/Topbar";
import { prisma } from "@/lib/db";
import { AssignmentForm } from "@/components/dashboard/AssignmentForm";
import { createAssignment } from "@/app/actions/assignments";
import { requireRoleOrRedirect } from "@/lib/auth";
import {
  canReassignFreelancer,
  canSetDiscount,
  eligibleFreelancerWhere,
  hasRole,
} from "@/lib/permissions";

export default async function NewAssignmentPage() {
  const session = await requireRoleOrRedirect(
    ["admin", "staff", "realtor"],
    "new-assignment",
  );
  const canFreelancer = canReassignFreelancer(session);
  // Admin/staff/realtor can attach supporting files at create time —
  // mirrors `canUploadToRealtorLane` for a brand-new (own) assignment.
  // Freelancers can't reach this page (requireRoleOrRedirect blocks them);
  // belt-and-braces guard so future role additions don't accidentally
  // expose the dropzone.
  const canUploadFiles = hasRole(session, "admin", "staff", "realtor");

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
        canUploadFiles={canUploadFiles}
        freelancers={freelancers}
      />
    </>
  );
}
