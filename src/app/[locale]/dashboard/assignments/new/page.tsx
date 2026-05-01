import { getTranslations } from "next-intl/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { prisma } from "@/lib/db";
import { AssignmentForm } from "@/components/dashboard/AssignmentForm";
import { createAssignment } from "@/app/actions/assignments";
import { requireRoleOrRedirect } from "@/lib/auth";
import {
  canReassignFreelancer,
  canSetDiscount,
  eligibleFreelancerWhere,
  getUserTeamIds,
  hasRole,
} from "@/lib/permissions";
import { getTeamPricelistItemsByService } from "@/lib/teamPricelistItems";

export default async function NewAssignmentPage() {
  const t = await getTranslations("dashboard.assignments.newPage");
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

  // Mirror the team-resolution logic in `createAssignmentInner` so we can
  // surface the matching team's per-service pricelist items at render time.
  // Admin/staff: rely on activeTeamId. Realtor: validate ownership, fall
  // back to first owned. Null teamId → no pricelist picker rendered.
  let teamId: string | null = session.activeTeamId ?? null;
  if (hasRole(session, "realtor")) {
    const { owned } = await getUserTeamIds(session.user.id);
    if (teamId && !owned.includes(teamId)) teamId = null;
    if (!teamId) teamId = owned[0] ?? null;
  }

  const [services, freelancers, pricelistData] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { key: "asc" } }),
    canFreelancer
      ? prisma.user.findMany({
          where: eligibleFreelancerWhere(),
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          take: 500,
          select: { id: true, firstName: true, lastName: true, region: true },
        })
      : Promise.resolve([]),
    getTeamPricelistItemsByService(teamId),
  ]);

  return (
    <>
      <Topbar title={t("title")} subtitle={t("subtitle")} />
      <div className="px-8 pt-8 pb-28 max-w-[960px]">
        <AssignmentForm
          services={services}
          action={createAssignment}
          canSetDiscount={canSetDiscount(session)}
          canSetFreelancer={canFreelancer}
          canUploadFiles={canUploadFiles}
          freelancers={freelancers}
          pricelistItemsByService={pricelistData.byService}
          odooError={pricelistData.odooError}
        />
      </div>
    </>
  );
}
