import { notFound } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dropzone } from "@/components/ui/Dropzone";
import { IconArrowRight, IconPlus } from "@/components/ui/Icons";
import { ASSIGNMENTS } from "@/lib/mockData";

function IconDownload({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconFile({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

type FileRow = { name: string; size: string; when: string };

const freelancerFiles: FileRow[] = [
  { name: "asbestos_inventory.pdf", size: "412 KB", when: "2 hours ago" },
  { name: "site_photos_front.zip", size: "8.4 MB", when: "2 hours ago" },
  { name: "lab_sample_results.pdf", size: "126 KB", when: "yesterday" },
  { name: "epc_final_report.pdf", size: "248 KB", when: "3 days ago" },
];

const realtorFiles: FileRow[] = [
  { name: "assignment_form.pdf", size: "98 KB", when: "6 days ago" },
  { name: "floor_plan.pdf", size: "1.2 MB", when: "6 days ago" },
];

function FileList({ files }: { files: FileRow[] }) {
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {files.map((f) => (
        <li
          key={f.name}
          className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-[var(--color-bg-alt)]"
        >
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-ink-soft)]">
            <IconFile />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--color-ink)]">
              {f.name}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
              {f.size} · {f.when}
            </p>
          </div>
          <Button variant="secondary" size="sm">
            <IconDownload size={14} />
            Download
          </Button>
        </li>
      ))}
    </ul>
  );
}

export default async function AssignmentFiles({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();
  const assignment = ASSIGNMENTS.find((a) => a.id === id);
  if (!assignment) notFound();

  return (
    <>
      <Topbar
        title={`${assignment.reference} — Files`}
        subtitle={`${assignment.address}, ${assignment.postal} ${assignment.city}`}
      />

      <div className="px-8 pt-6">
        <Tabs
          tabs={[
            { label: "Details", href: `/dashboard/assignments/${assignment.id}` },
            { label: "Edit", href: `/dashboard/assignments/${assignment.id}/edit` },
            { label: "Files", href: `/dashboard/assignments/${assignment.id}/files`, active: true },
            { label: "Complete", href: `/dashboard/assignments/${assignment.id}/complete` },
          ]}
        />
      </div>

      <div className="p-8 space-y-8 max-w-[960px]">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Freelancer uploads</CardTitle>
              <p className="text-sm text-[var(--color-ink-soft)] mt-1">
                Reports, photos, and lab results delivered by the inspector.
              </p>
            </div>
            <Button size="sm" variant="secondary">
              <IconPlus size={14} />
              Upload
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            <FileList files={freelancerFiles} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Realtor uploads</CardTitle>
              <p className="text-sm text-[var(--color-ink-soft)] mt-1">
                Documents provided by the requesting agency.
              </p>
            </div>
            <Button size="sm" variant="secondary">
              <IconPlus size={14} />
              Upload
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            <FileList files={realtorFiles} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner uploads</CardTitle>
          </CardHeader>
          <CardBody>
            <EmptyState
              icon={<IconFile size={20} />}
              title="No files from the owner yet"
              description="The owner hasn't uploaded anything for this assignment. Share the upload link to collect documents directly."
              action={
                <Button size="sm" variant="secondary">
                  Copy upload link
                  <IconArrowRight size={14} />
                </Button>
              }
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload a new file</CardTitle>
          </CardHeader>
          <CardBody>
            <Dropzone
              label="Drop files or click to upload"
              hint="Max 50 MB per file. Multiple files allowed."
              accept="PDF, JPG, PNG, ZIP"
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
