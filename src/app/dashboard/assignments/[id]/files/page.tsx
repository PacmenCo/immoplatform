import { notFound } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { FileList, type FileRow } from "@/components/ui/FileList";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import {
  canDeleteAssignmentFile,
  canUpdateAssignmentFields,
  canUploadToFreelancerLane,
  canUploadToRealtorLane,
  canViewAssignmentFiles,
} from "@/lib/permissions";
import { isTerminalStatus } from "@/lib/mockData";
import { FileUploadForm } from "./FileUploadForm";

export default async function AssignmentFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    select: {
      id: true,
      reference: true,
      address: true,
      city: true,
      postal: true,
      status: true,
      teamId: true,
      freelancerId: true,
      createdById: true,
    },
  });
  if (!assignment) notFound();
  if (!(await canViewAssignmentFiles(session, assignment))) notFound();

  const [canUploadFreelancer, canUploadRealtor, canEdit, files] = await Promise.all([
    canUploadToFreelancerLane(session, assignment),
    canUploadToRealtorLane(session, assignment),
    canUpdateAssignmentFields(session, assignment),
    prisma.assignmentFile.findMany({
      where: { assignmentId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        uploader: {
          select: { firstName: true, lastName: true },
        },
      },
    }),
  ]);

  const terminal = isTerminalStatus(assignment.status);

  const toRow = async (f: (typeof files)[number]): Promise<FileRow> => ({
    id: f.id,
    originalName: f.originalName,
    sizeBytes: f.sizeBytes,
    mimeType: f.mimeType,
    createdAt: f.createdAt,
    uploaderName: f.uploader
      ? `${f.uploader.firstName} ${f.uploader.lastName}`
      : null,
    canDelete: !terminal && (await canDeleteAssignmentFile(session, f)),
  });

  const freelancerRows = await Promise.all(
    files.filter((f) => f.lane === "freelancer").map(toRow),
  );
  const realtorRows = await Promise.all(
    files.filter((f) => f.lane === "realtor").map(toRow),
  );

  return (
    <>
      <Topbar
        title={`${assignment.reference} — Files`}
        subtitle={`${assignment.address}, ${assignment.postal} ${assignment.city}`}
      />

      <div className="px-8 pt-6">
        <Tabs
          tabs={[
            { label: "Details", href: `/dashboard/assignments/${id}` },
            ...(canEdit
              ? [{ label: "Edit", href: `/dashboard/assignments/${id}/edit` }]
              : []),
            { label: "Files", href: `/dashboard/assignments/${id}/files`, active: true },
          ]}
        />
      </div>

      <div className="p-8 space-y-6 max-w-[960px]">
        <Card>
          <CardHeader>
            <CardTitle>Freelancer deliverables</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Certificate PDFs and final reports from the assigned inspector.
            </p>
          </CardHeader>
          <CardBody className="space-y-5">
            <FileList
              files={freelancerRows}
              emptyMessage="The inspector hasn't uploaded a deliverable yet."
            />
            {canUploadFreelancer && !terminal && (
              <div className="border-t border-[var(--color-border)] pt-5">
                <FileUploadForm assignmentId={id} lane="freelancer" />
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Realtor uploads</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Floor plans, access notes, photos provided by the agency.
            </p>
          </CardHeader>
          <CardBody className="space-y-5">
            <FileList
              files={realtorRows}
              emptyMessage="No supporting documents uploaded yet."
            />
            {canUploadRealtor && !terminal && (
              <div className="border-t border-[var(--color-border)] pt-5">
                <FileUploadForm assignmentId={id} lane="realtor" />
              </div>
            )}
          </CardBody>
        </Card>

        {terminal && (
          <p className="text-xs text-[var(--color-ink-muted)]">
            This assignment is {assignment.status}. Uploads and deletions are closed.
          </p>
        )}
      </div>
    </>
  );
}
