import { notFound } from "next/navigation";
import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, ServicePill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  IconMapPin,
  IconMail,
  IconPhone,
  IconCalendar,
  IconCheck,
  IconPlus,
} from "@/components/ui/Icons";
import { ASSIGNMENTS, SERVICES, STATUS_META } from "@/lib/mockData";

export default async function AssignmentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignment = ASSIGNMENTS.find((a) => a.id === id);
  if (!assignment) notFound();

  const meta = STATUS_META[assignment.status];

  return (
    <>
      <Topbar
        title={assignment.reference}
        subtitle={`${assignment.address}, ${assignment.postal} ${assignment.city}`}
      />

      <div className="p-8 max-w-[1200px]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge bg={meta.bg} fg={meta.fg}>{meta.label}</Badge>
            {assignment.services.map((s) => (
              <ServicePill key={s} color={SERVICES[s].color} label={SERVICES[s].short} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button href={`/dashboard/assignments/${assignment.id}/edit`} variant="secondary" size="sm">
              Edit
            </Button>
            <Button size="sm">Mark as delivered</Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Property</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="flex items-start gap-3">
                  <IconMapPin size={18} className="mt-0.5 text-[var(--color-ink-muted)]" />
                  <div>
                    <p className="font-medium text-[var(--color-ink)]">{assignment.address}</p>
                    <p className="text-sm text-[var(--color-ink-soft)]">
                      {assignment.postal} {assignment.city}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-4 border-t border-[var(--color-border)] pt-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">Type</dt>
                    <dd className="mt-1 text-[var(--color-ink)]">Apartment</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">Built</dt>
                    <dd className="mt-1 text-[var(--color-ink)]">1985</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">Area</dt>
                    <dd className="mt-1 text-[var(--color-ink)]">120 m²</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Owner</CardTitle>
                </CardHeader>
                <CardBody className="space-y-2 text-sm">
                  <p className="font-medium text-[var(--color-ink)]">{assignment.owner.name}</p>
                  <a href={`mailto:${assignment.owner.email}`} className="flex items-center gap-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                    <IconMail size={14} />
                    {assignment.owner.email}
                  </a>
                  <a href={`tel:${assignment.owner.phone}`} className="flex items-center gap-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                    <IconPhone size={14} />
                    {assignment.owner.phone}
                  </a>
                </CardBody>
              </Card>

              {assignment.tenant ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Tenant</CardTitle>
                  </CardHeader>
                  <CardBody className="space-y-2 text-sm">
                    <p className="font-medium text-[var(--color-ink)]">{assignment.tenant.name}</p>
                    <a href={`mailto:${assignment.tenant.email}`} className="flex items-center gap-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                      <IconMail size={14} />
                      {assignment.tenant.email}
                    </a>
                    <a href={`tel:${assignment.tenant.phone}`} className="flex items-center gap-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                      <IconPhone size={14} />
                      {assignment.tenant.phone}
                    </a>
                  </CardBody>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Tenant</CardTitle>
                  </CardHeader>
                  <CardBody className="text-sm text-[var(--color-ink-muted)]">
                    No tenant on file.
                  </CardBody>
                </Card>
              )}
            </div>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Comments</CardTitle>
                <span className="text-xs text-[var(--color-ink-muted)]">3 comments</span>
              </CardHeader>
              <CardBody className="space-y-5">
                <Comment
                  name="Els Vermeulen"
                  avatar="EV"
                  when="2 days ago"
                  body="Tenant prefers morning visit. Key is at the reception desk on the ground floor."
                />
                <Comment
                  name={assignment.freelancer?.name ?? "Unassigned"}
                  avatar={assignment.freelancer?.avatar ?? "?"}
                  when="1 day ago"
                  body="Noted. I'll bring the extended sampling kit since the building is pre-1985."
                />
                <Comment
                  name="System"
                  avatar="SY"
                  when="6 hr ago"
                  body="Calendar event pushed to Tim's Google Calendar."
                />

                <div className="pt-4 border-t border-[var(--color-border)]">
                  <div className="flex gap-3">
                    <Avatar initials="JR" size="sm" color="#0f172a" />
                    <div className="flex-1">
                      <textarea
                        placeholder="Add a comment…"
                        rows={2}
                        className="w-full rounded-md border border-[var(--color-border-strong)] bg-white px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
                      />
                      <div className="mt-2 flex justify-end">
                        <Button size="sm">Post comment</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Scheduling</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-muted)]">Preferred date</span>
                  <span className="font-medium text-[var(--color-ink)]">{assignment.preferredDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-muted)]">Calendar</span>
                  <span className="inline-flex items-center gap-1 text-[var(--color-epc)]">
                    <IconCheck size={14} /> Synced
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-muted)]">Key pickup</span>
                  <span className="font-medium text-[var(--color-ink)]">Owner address</span>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assigned to</CardTitle>
              </CardHeader>
              <CardBody>
                {assignment.freelancer ? (
                  <div className="flex items-center gap-3">
                    <Avatar initials={assignment.freelancer.avatar} size="md" />
                    <div>
                      <p className="font-medium text-[var(--color-ink)]">{assignment.freelancer.name}</p>
                      <p className="text-xs text-[var(--color-ink-muted)]">Asbestos inspector</p>
                    </div>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm">
                    <IconPlus size={14} />
                    Assign freelancer
                  </Button>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Files</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                <FileRow name="assignment_form.pdf" size="124 KB" />
                <FileRow name="photos_front.zip" size="8.4 MB" />
                <FileRow name="asbestos_report.pdf" size="210 KB" />
                <Button variant="ghost" size="sm" className="mt-2">
                  <IconPlus size={14} />
                  Upload file
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team</CardTitle>
              </CardHeader>
              <CardBody className="text-sm">
                <Link href="/dashboard/teams" className="font-medium text-[var(--color-ink)] hover:underline">
                  {assignment.team}
                </Link>
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                  Created {assignment.createdAt}
                </p>
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}

function Comment({
  name,
  avatar,
  when,
  body,
}: {
  name: string;
  avatar: string;
  when: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <Avatar initials={avatar} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-[var(--color-ink)]">{name}</span>
          <span className="text-xs text-[var(--color-ink-muted)]">{when}</span>
        </div>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{body}</p>
      </div>
    </div>
  );
}

function FileRow({ name, size }: { name: string; size: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="truncate text-[var(--color-ink)]">{name}</span>
      <span className="text-xs text-[var(--color-ink-muted)] shrink-0 ml-3">{size}</span>
    </div>
  );
}
