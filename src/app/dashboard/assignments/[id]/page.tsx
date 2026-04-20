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
  IconFileText,
  IconDownload,
} from "@/components/ui/Icons";
import { STATUS_META, Status, isTerminalStatus } from "@/lib/mockData";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import {
  canCancelAssignment,
  canCompleteAssignment,
  canEditAssignment,
  canReassignFreelancer,
  canViewAssignment,
  eligibleFreelancerWhere,
} from "@/lib/permissions";
import { initials } from "@/lib/format";
import { CommentForm } from "./CommentForm";
import { AssignmentActions } from "./AssignmentActions";
import { ReassignFreelancerButton } from "./ReassignFreelancerButton";

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return date.toISOString().slice(0, 10);
}

export default async function AssignmentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [assignment, services] = await Promise.all([
    prisma.assignment.findUnique({
      where: { id },
      include: {
        team: true,
        freelancer: true,
        services: true,
        comments: {
          include: { author: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.service.findMany(),
  ]);

  if (!assignment) notFound();
  if (!(await canViewAssignment(session, assignment))) notFound();

  const [canEdit, canComplete, canCancel, canReassign] = await Promise.all([
    canEditAssignment(session, assignment),
    canCompleteAssignment(session, assignment),
    canCancelAssignment(session, assignment),
    canReassignFreelancer(session, assignment),
  ]);

  // Only fetch when the user can reassign, AND scope to freelancers already in
  // the caller's orbit (team members, or previously assigned to their work).
  // Prevents cross-tenant enumeration of the full freelancer roster.
  const eligibleFreelancers = canReassign
    ? await prisma.user.findMany({
        where: await eligibleFreelancerWhere(session),
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        take: 500,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          region: true,
        },
      })
    : [];

  const servicesByKey = Object.fromEntries(services.map((s) => [s.key, s]));
  const meta = STATUS_META[assignment.status as Status] ?? STATUS_META.draft;
  const isTerminal = isTerminalStatus(assignment.status);

  return (
    <>
      <Topbar
        title={assignment.reference}
        subtitle={`${assignment.address}, ${assignment.postal} ${assignment.city}`}
      />

      <div className="p-8 max-w-[1200px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge bg={meta.bg} fg={meta.fg}>{meta.label}</Badge>
            {assignment.services.map((s) => {
              const svc = servicesByKey[s.serviceKey];
              return svc ? (
                <ServicePill key={s.serviceKey} color={svc.color} label={svc.short} />
              ) : null;
            })}
          </div>
          <AssignmentActions
            assignmentId={assignment.id}
            status={assignment.status}
            canEdit={canEdit}
            canComplete={canComplete}
            canCancel={canCancel}
          />
        </div>

        {assignment.status === "cancelled" && assignment.cancellationReason && (
          <Card className="mb-6 border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_4%,var(--color-bg))]">
            <CardBody>
              <p className="text-xs uppercase tracking-wider text-[var(--color-asbestos)]">
                Cancellation reason
              </p>
              <p className="mt-1 text-sm text-[var(--color-ink)]">
                {assignment.cancellationReason}
              </p>
              {assignment.cancelledAt && (
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                  {assignment.cancelledAt.toISOString().slice(0, 10)}
                </p>
              )}
            </CardBody>
          </Card>
        )}

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
                    <dd className="mt-1 capitalize text-[var(--color-ink)]">{assignment.propertyType ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">Built</dt>
                    <dd className="mt-1 text-[var(--color-ink)]">{assignment.constructionYear ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">Area</dt>
                    <dd className="mt-1 text-[var(--color-ink)]">
                      {assignment.areaM2 ? `${assignment.areaM2} m²` : "—"}
                    </dd>
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
                  <p className="font-medium text-[var(--color-ink)]">{assignment.ownerName}</p>
                  {assignment.ownerEmail && (
                    <a href={`mailto:${assignment.ownerEmail}`} className="flex items-center gap-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                      <IconMail size={14} />
                      {assignment.ownerEmail}
                    </a>
                  )}
                  {assignment.ownerPhone && (
                    <a href={`tel:${assignment.ownerPhone}`} className="flex items-center gap-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                      <IconPhone size={14} />
                      {assignment.ownerPhone}
                    </a>
                  )}
                </CardBody>
              </Card>

              {assignment.tenantName ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Tenant</CardTitle>
                  </CardHeader>
                  <CardBody className="space-y-2 text-sm">
                    <p className="font-medium text-[var(--color-ink)]">{assignment.tenantName}</p>
                    {assignment.tenantEmail && (
                      <a href={`mailto:${assignment.tenantEmail}`} className="flex items-center gap-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                        <IconMail size={14} />
                        {assignment.tenantEmail}
                      </a>
                    )}
                    {assignment.tenantPhone && (
                      <a href={`tel:${assignment.tenantPhone}`} className="flex items-center gap-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                        <IconPhone size={14} />
                        {assignment.tenantPhone}
                      </a>
                    )}
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
                <span className="text-xs text-[var(--color-ink-muted)]">
                  {assignment.comments.length} comment{assignment.comments.length === 1 ? "" : "s"}
                </span>
              </CardHeader>
              <CardBody className="space-y-5">
                {assignment.comments.length === 0 ? (
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    No comments yet. Start the conversation.
                  </p>
                ) : (
                  assignment.comments.map((c) => {
                    const authorName = c.author
                      ? `${c.author.firstName} ${c.author.lastName}`
                      : c.authorLabel ?? "System";
                    const authorInitials = c.author
                      ? initials(c.author.firstName, c.author.lastName)
                      : "SY";
                    return (
                      <div key={c.id} className="flex gap-3">
                        <Avatar initials={authorInitials} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-[var(--color-ink)]">
                              {authorName}
                            </span>
                            <span className="text-xs text-[var(--color-ink-muted)]">
                              {timeAgo(c.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                            {c.body}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}

                <div className="pt-4 border-t border-[var(--color-border)]">
                  <CommentForm assignmentId={assignment.id} />
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
                  <span className="font-medium text-[var(--color-ink)] tabular-nums">
                    {assignment.preferredDate?.toISOString().slice(0, 10) ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-muted)]">Key pickup</span>
                  <span className="font-medium capitalize text-[var(--color-ink)]">
                    {assignment.keyPickup ?? "—"}
                  </span>
                </div>
                <div className="pt-2 border-t border-[var(--color-border)]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Calendar
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-epc)]">
                    <IconCheck size={12} />
                    Not yet synced
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" className="flex-1">
                      <IconCalendar size={12} />
                      Sync
                    </Button>
                    <Button variant="secondary" size="sm" className="flex-1">
                      Outlook…
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assignment form</CardTitle>
                <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                  PDF opdrachtformulier.
                </p>
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--color-bg)] text-[var(--color-asbestos)]">
                    <IconFileText size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--color-ink)]">
                      {assignment.reference}.pdf
                    </p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      Generate when ready
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1">
                    Preview
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1">
                    <IconDownload size={12} />
                    Download
                  </Button>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Assigned to</CardTitle>
                {canReassign && !isTerminal && assignment.freelancer && (
                  <ReassignFreelancerButton
                    assignmentId={assignment.id}
                    currentFreelancerId={assignment.freelancer.id}
                    freelancers={eligibleFreelancers}
                    triggerLabel="reassign"
                  />
                )}
              </CardHeader>
              <CardBody>
                {assignment.freelancer ? (
                  <Link
                    href={`/dashboard/users/${assignment.freelancer.id}`}
                    className="group block -m-2 rounded-md p-2 transition-colors hover:bg-[var(--color-bg-alt)]"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        initials={initials(
                          assignment.freelancer.firstName,
                          assignment.freelancer.lastName,
                        )}
                        size="md"
                      />
                      <div>
                        <p className="font-medium text-[var(--color-ink)] group-hover:underline">
                          {assignment.freelancer.firstName} {assignment.freelancer.lastName}
                        </p>
                        <p className="text-xs text-[var(--color-ink-muted)]">
                          Inspector
                        </p>
                      </div>
                    </div>
                  </Link>
                ) : canReassign && !isTerminal ? (
                  <ReassignFreelancerButton
                    assignmentId={assignment.id}
                    currentFreelancerId={null}
                    freelancers={eligibleFreelancers}
                    triggerLabel="assign"
                  />
                ) : (
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    No freelancer assigned yet.
                  </p>
                )}
              </CardBody>
            </Card>

            {assignment.team && (
              <Card>
                <CardHeader>
                  <CardTitle>Team</CardTitle>
                </CardHeader>
                <CardBody className="text-sm">
                  <Link
                    href={`/dashboard/teams/${assignment.team.id}`}
                    className="font-medium text-[var(--color-ink)] hover:underline"
                  >
                    {assignment.team.name}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                    Created {assignment.createdAt.toISOString().slice(0, 10)}
                  </p>
                </CardBody>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
