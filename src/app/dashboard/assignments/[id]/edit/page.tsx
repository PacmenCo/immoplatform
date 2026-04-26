import { notFound } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Tabs } from "@/components/ui/Tabs";
import { AssignmentForm } from "@/components/dashboard/AssignmentForm";
import type { AssignmentFormInitial } from "@/components/dashboard/AssignmentForm";
import { FreelancerEditForm } from "./FreelancerEditForm";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import {
  canEditAssignment,
  canReassignFreelancer,
  canSetDiscount,
  canUpdateAssignmentFields,
  eligibleFreelancerWhere,
  hasRole,
} from "@/lib/permissions";
import { isDiscountType } from "@/lib/pricing";
import { updateAssignment } from "@/app/actions/assignments";

export default async function EditAssignment({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const canFreelancer = canReassignFreelancer(session);
  const [assignment, services, freelancers] = await Promise.all([
    prisma.assignment.findUnique({
      where: { id },
      include: { services: true },
    }),
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

  if (!assignment) notFound();
  // canEditAssignment is the wider gate that includes freelancers on their
  // own rows. canUpdateAssignmentFields is the narrower gate that excludes
  // freelancer (used for the wide-edit form). v1 parity: Platform exposes
  // a freelancer-restricted edit form (date-only) at the same route via
  // role-aware validation in AssignmentController::update. v2 splits the
  // form rendering by role here.
  if (!(await canEditAssignment(session, assignment))) notFound();
  const isFreelancer = hasRole(session, "freelancer");
  const canWideEdit = await canUpdateAssignmentFields(session, assignment);
  if (!isFreelancer && !canWideEdit) notFound();

  const initial: AssignmentFormInitial = {
    address: assignment.address,
    city: assignment.city,
    postal: assignment.postal,
    propertyType: assignment.propertyType,
    constructionYear: assignment.constructionYear,
    areaM2: assignment.areaM2,
    quantity: assignment.quantity,
    isLargeProperty: assignment.isLargeProperty,
    services: assignment.services.map((s) => s.serviceKey),
    owner: {
      name: assignment.ownerName,
      email: assignment.ownerEmail,
      phone: assignment.ownerPhone,
      address: assignment.ownerAddress,
      postal: assignment.ownerPostal,
      city: assignment.ownerCity,
      vatNumber: assignment.ownerVatNumber,
    },
    clientType:
      assignment.clientType === "owner" || assignment.clientType === "firm"
        ? assignment.clientType
        : null,
    tenant: {
      name: assignment.tenantName,
      email: assignment.tenantEmail,
      phone: assignment.tenantPhone,
    },
    contactEmail: assignment.contactEmail,
    contactPhone: assignment.contactPhone,
    photographerContactPerson: assignment.photographerContactPerson,
    preferredDate: assignment.preferredDate
      ? assignment.preferredDate.toISOString().slice(0, 10)
      : null,
    calendarDate: assignment.calendarDate
      ? assignment.calendarDate.toISOString().slice(0, 16)
      : null,
    calendarAccountEmail: assignment.calendarAccountEmail,
    requiresKeyPickup: assignment.requiresKeyPickup,
    keyPickupLocationType:
      assignment.keyPickupLocationType === "office" ||
      assignment.keyPickupLocationType === "other"
        ? assignment.keyPickupLocationType
        : null,
    keyPickupAddress: assignment.keyPickupAddress,
    notes: assignment.notes,
    freelancerId: assignment.freelancerId,
    discount: {
      type: isDiscountType(assignment.discountType)
        ? assignment.discountType
        : null,
      value: assignment.discountValue,
      reason: assignment.discountReason,
    },
  };

  const boundUpdate = updateAssignment.bind(null, id);
  const discountEditor = canSetDiscount(session);

  return (
    <>
      <Topbar
        title={`Edit ${assignment.reference}`}
        subtitle={`${assignment.address}, ${assignment.postal} ${assignment.city}`}
      />

      <div className="px-8 pt-6">
        <Tabs
          tabs={[
            { label: "Details", href: `/dashboard/assignments/${id}` },
            { label: "Edit", href: `/dashboard/assignments/${id}/edit`, active: true },
            { label: "Files", href: `/dashboard/assignments/${id}/files` },
          ]}
        />
      </div>

      {isFreelancer ? (
        <FreelancerEditForm
          action={boundUpdate}
          initialDate={initial.preferredDate}
          loadedAt={assignment.updatedAt.toISOString()}
          cancelHref={`/dashboard/assignments/${id}`}
        />
      ) : (
        <AssignmentForm
          services={services}
          action={boundUpdate}
          initial={initial}
          cancelHref={`/dashboard/assignments/${id}`}
          canSetDiscount={discountEditor}
          canSetFreelancer={canFreelancer}
          freelancers={freelancers}
          loadedAt={assignment.updatedAt.toISOString()}
        />
      )}
    </>
  );
}
