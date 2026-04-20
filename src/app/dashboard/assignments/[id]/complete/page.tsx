import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Tabs } from "@/components/ui/Tabs";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canCompleteAssignment } from "@/lib/permissions";
import { CompleteForm } from "./CompleteForm";

export default async function CompleteAssignment({
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
    prisma.service.findMany(),
  ]);

  if (!assignment) notFound();
  if (!(await canCompleteAssignment(session, assignment))) notFound();
  if (assignment.status !== "delivered") {
    redirect(`/dashboard/assignments/${id}`);
  }

  const servicesByKey = Object.fromEntries(services.map((s) => [s.key, s]));
  const assignmentServices = assignment.services
    .map((s) => servicesByKey[s.serviceKey])
    .filter((s): s is (typeof services)[number] => !!s)
    .map((s) => ({ key: s.key, short: s.short, color: s.color }));

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const defaultFinishedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <>
      <Topbar
        title={`Complete ${assignment.reference}`}
        subtitle={`${assignment.address}, ${assignment.postal} ${assignment.city}`}
      />

      <div className="px-8 pt-6">
        <Tabs
          tabs={[
            { label: "Details", href: `/dashboard/assignments/${id}` },
            { label: "Edit", href: `/dashboard/assignments/${id}/edit` },
            { label: "Files", href: `/dashboard/assignments/${id}/files` },
            {
              label: "Complete",
              href: `/dashboard/assignments/${id}/complete`,
              active: true,
            },
          ]}
        />
      </div>

      <div className="p-8">
        <CompleteForm
          assignmentId={id}
          reference={assignment.reference}
          services={assignmentServices}
          defaultFinishedAt={defaultFinishedAt}
          cancelHref={`/dashboard/assignments/${id}`}
        />
      </div>
    </>
  );
}
