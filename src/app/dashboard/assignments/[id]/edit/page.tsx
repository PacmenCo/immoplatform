import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Tabs } from "@/components/ui/Tabs";
import { AssignmentForm } from "@/components/dashboard/AssignmentForm";
import type { AssignmentFormInitial } from "@/components/dashboard/AssignmentForm";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canUpdateAssignmentFields } from "@/lib/permissions";
import { updateAssignment } from "@/app/actions/assignments";

export default async function EditAssignment({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [assignment, services] = await Promise.all([
    prisma.assignment.findUnique({
      where: { id },
      include: { services: true },
    }),
    prisma.service.findMany({ where: { active: true }, orderBy: { key: "asc" } }),
  ]);

  if (!assignment) notFound();
  if (!(await canUpdateAssignmentFields(session, assignment))) notFound();
  if (assignment.status === "completed" || assignment.status === "cancelled") {
    redirect(`/dashboard/assignments/${id}`);
  }

  const initial: AssignmentFormInitial = {
    address: assignment.address,
    city: assignment.city,
    postal: assignment.postal,
    propertyType: assignment.propertyType,
    constructionYear: assignment.constructionYear,
    areaM2: assignment.areaM2,
    services: assignment.services.map((s) => s.serviceKey),
    owner: {
      name: assignment.ownerName,
      email: assignment.ownerEmail,
      phone: assignment.ownerPhone,
    },
    tenant: {
      name: assignment.tenantName,
      email: assignment.tenantEmail,
      phone: assignment.tenantPhone,
    },
    preferredDate: assignment.preferredDate
      ? assignment.preferredDate.toISOString().slice(0, 10)
      : null,
    keyPickup: assignment.keyPickup,
    notes: assignment.notes,
  };

  const boundUpdate = updateAssignment.bind(null, id);

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
            { label: "Complete", href: `/dashboard/assignments/${id}/complete` },
          ]}
        />
      </div>

      <AssignmentForm
        services={services}
        action={boundUpdate}
        initial={initial}
        cancelHref={`/dashboard/assignments/${id}`}
      />
    </>
  );
}
