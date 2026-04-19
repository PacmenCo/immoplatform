import { notFound } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Dropzone } from "@/components/ui/Dropzone";
import { Button } from "@/components/ui/Button";
import { ServicePill } from "@/components/ui/Badge";
import { ASSIGNMENTS, SERVICES } from "@/lib/mockData";

export default async function CompleteAssignment({
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
        title={`Complete ${assignment.reference}`}
        subtitle={`${assignment.address}, ${assignment.postal} ${assignment.city}`}
      />

      <div className="px-8 pt-6">
        <Tabs
          tabs={[
            { label: "Details", href: `/dashboard/assignments/${assignment.id}` },
            { label: "Edit", href: `/dashboard/assignments/${assignment.id}/edit` },
            { label: "Files", href: `/dashboard/assignments/${assignment.id}/files` },
            { label: "Complete", href: `/dashboard/assignments/${assignment.id}/complete`, active: true },
          ]}
        />
      </div>

      <div className="p-8">
        <Modal
          title="Mark assignment as completed"
          description="Wrap up the inspection, upload the final deliverables, and move this assignment out of your active queue."
          footer={
            <>
              <Button
                variant="ghost"
                size="md"
                href={`/dashboard/assignments/${assignment.id}`}
              >
                Cancel
              </Button>
              <Button type="submit" size="md">
                Mark as completed
              </Button>
            </>
          }
        >
          <form className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-bg-alt)] px-4 py-3">
              <span className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                Services
              </span>
              {assignment.services.map((s) => (
                <ServicePill
                  key={s}
                  color={SERVICES[s].color}
                  label={SERVICES[s].short}
                />
              ))}
            </div>

            <Field
              label="Completion notes"
              id="completion-notes"
              hint="Any caveats, follow-ups, or context for the office."
            >
              <Textarea
                id="completion-notes"
                rows={5}
                placeholder="Everything went smoothly. Owner was on site, access was fine. Lab results expected within 48 hours."
              />
            </Field>

            <Field
              label="Finished at"
              id="finished-at"
              hint="Date and time the on-site work wrapped up."
            >
              <Input
                id="finished-at"
                type="datetime-local"
                defaultValue="2026-04-18T14:30"
              />
            </Field>

            <Field
              label="Final files"
              id="final-files"
              hint="Attach the signed report and any remaining photos."
            >
              <Dropzone
                label="Drop the final report or click to upload"
                hint="PDF is preferred. Multiple files allowed."
                accept="PDF, JPG, PNG"
              />
            </Field>
          </form>
        </Modal>
      </div>
    </>
  );
}
