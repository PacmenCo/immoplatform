import { Topbar } from "@/components/dashboard/Topbar";
import { prisma } from "@/lib/db";
import { NewAssignmentForm } from "./NewAssignmentForm";

export default async function NewAssignmentPage() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { key: "asc" },
  });

  return (
    <>
      <Topbar title="New assignment" subtitle="Create a new property inspection" />
      <NewAssignmentForm services={services} />
    </>
  );
}
