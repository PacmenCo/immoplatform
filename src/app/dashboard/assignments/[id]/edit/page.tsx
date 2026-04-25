import { notFound } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Tabs } from "@/components/ui/Tabs";
import { AssignmentForm } from "@/components/dashboard/AssignmentForm";
import type { AssignmentFormInitial } from "@/components/dashboard/AssignmentForm";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import {
  canReassignFreelancer,
  canSetDiscount,
  canUpdateAssignmentFields,
  eligibleFreelancerWhere,
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
  if (!(await canUpdateAssignmentFields(session, assignment))) notFound();
  // v1 parity: AssignmentPolicy::update (Platform/app/Policies/
  // AssignmentPolicy.php:85-94) does NOT gate on status — admin/realtor-
  // owner can edit fields on terminal (completed/cancelled) assignments
  // too. Commission snapshots are already frozen, so address/contact-info
  // edits are non-destructive. Earlier v2 redirected here, which made the
  // Edit tab in /[id]/page.tsx render a dead link. Drop the redirect.

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
    </>
  );
}
