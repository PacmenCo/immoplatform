import { Topbar } from "@/components/dashboard/Topbar";
import { prisma } from "@/lib/db";
import { AssignmentForm } from "@/components/dashboard/AssignmentForm";
import { createAssignment } from "@/app/actions/assignments";

export default async function NewAssignmentPage() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { key: "asc" },
  });

  return (
    <>
      <Topbar title="New assignment" subtitle="Create a new property inspection" />
      <AssignmentForm
        services={services}
        action={createAssignment}
        cancelHref="/dashboard/assignments"
      />
    </>
  );
}
