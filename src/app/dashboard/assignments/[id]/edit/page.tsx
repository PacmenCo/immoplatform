import { notFound } from "next/navigation";
import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, ServicePill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { FileList, type FileRow } from "@/components/ui/FileList";
import {
  IconFileText,
  IconMail,
  IconPhone,
} from "@/components/ui/Icons";
import { AssignmentForm } from "@/components/dashboard/AssignmentForm";
import type { AssignmentFormInitial } from "@/components/dashboard/AssignmentForm";
import { FreelancerEditForm } from "./FreelancerEditForm";
import { CalendarChips } from "../CalendarChips";
import { CommentForm } from "../CommentForm";
import { DeleteAssignmentButton } from "../DeleteAssignmentButton";
import { DownloadAssignmentPdfButton } from "../DownloadAssignmentPdfButton";
import { Notice } from "../Notice";
import { AssignedToCard } from "../AssignedToCard";
import { FileUploadForm } from "../files/FileUploadForm";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import {
  canDeleteAssignment,
  canDeleteAssignmentFile,
  canEditAssignment,
  canReassignFreelancer,
  canSetDiscount,
  canUploadToFreelancerLane,
  canUploadToRealtorLane,
  canViewAssignment,
  canViewAssignmentPricing,
  canViewCommission,
  eligibleFreelancerWhere,
  hasRole,
  role,
} from "@/lib/permissions";
import { StatusPicker } from "../../StatusPicker";
import { STATUS_META, Status, isTerminalStatus } from "@/lib/mockData";
import { formatCommissionRate, formatEuros, initials } from "@/lib/format";
import { isDiscountType, loadAssignmentPricing } from "@/lib/pricing";
import { loadAssignmentCommission } from "@/lib/commission";
import { updateAssignment } from "@/app/actions/assignments";
import { getTeamPricelistItemsByService } from "@/lib/teamPricelistItems";

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

export const metadata = { title: "Assignment" };

export default async function AssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const notice = typeof sp.notice === "string" ? sp.notice : null;

  const session = await requireSession();
  const isFreelancer = hasRole(session, "freelancer");
  const canFreelancer = canReassignFreelancer(session);

  // Single-pass fetch of everything the page might render.
  const [assignment, services, freelancers] = await Promise.all([
    prisma.assignment.findUnique({
      where: { id },
      include: {
        team: true,
        freelancer: true,
        services: true,
        comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.service.findMany({ orderBy: { key: "asc" } }),
    canFreelancer
      ? prisma.user.findMany({
          where: eligibleFreelancerWhere(),
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
      : Promise.resolve([]),
  ]);

  if (!assignment) notFound();
  // Page is reachable to anyone who can view — view-only realtors land here
  // and see the form rendered with `readOnly` (inputs disabled, no Save).
  // Stricter gates (canEdit, canUpload*) drive what each section renders.
  if (!(await canViewAssignment(session, assignment))) notFound();

  const [
    canEdit,
    canPricing,
    canDelete,
    canUploadFreelancer,
    canUploadRealtor,
    pricelistData,
  ] = await Promise.all([
    canEditAssignment(session, assignment),
    canViewAssignmentPricing(session, assignment),
    canDeleteAssignment(session, assignment),
    canUploadToFreelancerLane(session, assignment),
    canUploadToRealtorLane(session, assignment),
    // Freelancers see FreelancerEditForm, never AssignmentForm — skip the
    // Odoo round-trip whose result they'd never consume.
    isFreelancer
      ? Promise.resolve({ byService: {}, odooError: null })
      : getTeamPricelistItemsByService(assignment.teamId),
  ]);
  const canCommission = assignment.teamId
    ? await canViewCommission(session, assignment.teamId)
    : false;

  // View-only flag: viewer can see this assignment but isn't an editor and
  // isn't a freelancer. Drives the readOnly form render.
  const isViewOnly = !canEdit && !isFreelancer;

  // Pricing + commission gated by their own flags so we don't pay for the
  // load when the viewer can't see the cards.
  const pricing = canPricing ? await loadAssignmentPricing(id) : null;
  const commission = canCommission ? await loadAssignmentCommission(id) : null;

  // Files (anyone who can view the page can see file metadata; uploads are
  // gated separately).
  const fileRows = await prisma.assignmentFile.findMany({
    where: { assignmentId: id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      uploader: { select: { firstName: true, lastName: true } },
    },
  });
  const terminal = isTerminalStatus(assignment.status);
  const toRow = async (f: (typeof fileRows)[number]): Promise<FileRow> => ({
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
  const freelancerFileRows = await Promise.all(
    fileRows.filter((f) => f.lane === "freelancer").map(toRow),
  );
  const realtorFileRows = await Promise.all(
    fileRows.filter((f) => f.lane === "realtor").map(toRow),
  );

  // Calendar chip state — per-viewer.
  const viewerGoogleAccount = await prisma.calendarAccount.findUnique({
    where: {
      userId_provider: { userId: session.user.id, provider: "google" },
    },
  });
  const canAddPersonalGoogle =
    !!viewerGoogleAccount && !viewerGoogleAccount.disconnectedAt;
  const personalGoogleAdded = canAddPersonalGoogle
    ? !!(await prisma.assignmentCalendarEvent.findUnique({
        where: {
          assignmentId_calendarAccountId: {
            assignmentId: id,
            calendarAccountId: viewerGoogleAccount!.id,
          },
        },
        select: { id: true },
      }))
    : false;
  const ownOutlook = !!(
    assignment.outlookCalendarEventId &&
    assignment.createdById === session.user.id
  );


  const initial: AssignmentFormInitial = {
    address: assignment.address,
    city: assignment.city,
    postal: assignment.postal,
    propertyType: assignment.propertyType,
    constructionYear: assignment.constructionYear,
    areaM2: assignment.areaM2,
    isLargeProperty: assignment.isLargeProperty,
    services: assignment.services.map((s) => s.serviceKey),
    serviceProducts: Object.fromEntries(
      assignment.services.map((s) => [s.serviceKey, s.odooProductTemplateId]),
    ),
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
  const servicesByKey = Object.fromEntries(services.map((s) => [s.key, s]));
  const meta = STATUS_META[assignment.status as Status] ?? STATUS_META.draft;

  return (
    <>
      <Notice notice={notice} />
      <Topbar
        title={assignment.reference}
        subtitle={`${assignment.address}, ${assignment.postal} ${assignment.city}`}
      />

      <div className="p-8 max-w-[1400px]">
        {/* Service pills + calendar chips on the left, action buttons on the
            right. Status moved into the Scheduling card below — it groups
            naturally with planned date + key pickup, and removing it here
            de-clutters the top row. */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {assignment.services.map((s) => {
              const svc = servicesByKey[s.serviceKey];
              return svc ? (
                <ServicePill
                  key={s.serviceKey}
                  color={svc.color}
                  label={svc.short}
                />
              ) : null;
            })}
            <CalendarChips
              assignmentId={assignment.id}
              agencyGoogle={!!assignment.googleCalendarEventId}
              ownOutlook={ownOutlook}
              personalGoogleAdded={personalGoogleAdded}
              canAddPersonalGoogle={canAddPersonalGoogle}
            />
          </div>
          {/* Action toolbar — Edit / Start / Mark delivered / Mark completed /
              Cancel are intentionally hidden for now (product call). The
              `AssignmentActions` component + permission flags + server actions
              are intact so we can re-enable later by re-rendering the block.
              Delete stays, gated to admin-or-creator only. */}
          <div className="flex flex-wrap items-center gap-2">
            {canDelete && (
              <DeleteAssignmentButton
                assignmentId={assignment.id}
                reference={assignment.reference}
              />
            )}
          </div>
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
          <div className="lg:col-span-2 space-y-6 min-w-0">
            {/* The form. Three rendering modes:
                - freelancer (assigned): narrow date-only form
                - editor (admin/staff/realtor with edit perms): wide editable form
                - view-only (realtor team-member): wide form, all inputs disabled, no Save */}
            {isFreelancer ? (
              <FreelancerEditForm
                action={boundUpdate}
                initialDate={initial.preferredDate}
                loadedAt={assignment.updatedAt.toISOString()}
                cancelHref="/dashboard/assignments"
                readOnly={terminal}
              />
            ) : (
              <AssignmentForm
                services={services}
                action={boundUpdate}
                initial={initial}
                cancelHref="/dashboard/assignments"
                canSetDiscount={discountEditor}
                canSetFreelancer={canFreelancer}
                freelancers={freelancers}
                loadedAt={assignment.updatedAt.toISOString()}
                pricelistItemsByService={pricelistData.byService}
                odooError={pricelistData.odooError}
                readOnly={isViewOnly || terminal}
              />
            )}

            {/* Files — both lanes. Visibility = anyone who can view the page;
                upload = role-gated; delete = per-row. */}
            <Card>
              <CardHeader>
                <CardTitle>Deliverables</CardTitle>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                  Certificate PDFs and photos from the assigned inspector.
                </p>
              </CardHeader>
              <CardBody className="space-y-5">
                <FileList
                  files={freelancerFileRows}
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
                  files={realtorFileRows}
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

            {/* Comments — anyone who can view the assignment can comment.
                postComment server action enforces canViewAssignment. */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Comments</CardTitle>
                <span className="text-xs text-[var(--color-ink-muted)]">
                  {assignment.comments.length} comment
                  {assignment.comments.length === 1 ? "" : "s"}
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
                  <CommentForm
                    assignmentId={assignment.id}
                    authorInitials={initials(
                      session.user.firstName,
                      session.user.lastName,
                    )}
                  />
                </div>
              </CardBody>
            </Card>
          </div>

          {/* `lg:mt-8` compensates for the AssignmentForm's internal `p-8`
              top-padding so the aside's first card aligns with the Property
              card across the column gap. Aside scrolls with the page (no
              sticky) — user wants to skim sidebar cards quickly without them
              pinning to the viewport top. */}
          <aside className="space-y-6 lg:self-start min-w-0 lg:mt-8">
            {assignment.team && (
              <Card>
                <CardHeader>
                  <CardTitle>Team</CardTitle>
                </CardHeader>
                <CardBody className="text-sm">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                      style={{
                        backgroundColor: assignment.team.logoColor ?? "#0f172a",
                      }}
                      aria-hidden
                    >
                      {assignment.team.logo ??
                        assignment.team.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      {isFreelancer ? (
                        <span className="block truncate font-medium text-[var(--color-ink)]">
                          {assignment.team.name}
                        </span>
                      ) : (
                        <Link
                          href={`/dashboard/teams/${assignment.team.id}`}
                          className="block truncate font-medium text-[var(--color-ink)] hover:underline"
                        >
                          {assignment.team.name}
                        </Link>
                      )}
                      {assignment.team.legalName &&
                        assignment.team.legalName !== assignment.team.name && (
                          <span className="block truncate text-xs text-[var(--color-ink-muted)]">
                            {assignment.team.legalName}
                          </span>
                        )}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
                    Created {assignment.createdAt.toISOString().slice(0, 10)}
                  </p>
                </CardBody>
              </Card>
            )}

            <Card className="lg:min-h-[391px]">
              <CardHeader>
                <CardTitle>Scheduling</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4 text-sm">
                {/* Status stays interactive even on terminal rows — the
                    changeAssignmentStatus action permits reversing an
                    accidental complete/cancel back into the active flow.
                    Field edits are still locked (form readOnly above). */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-ink-muted)]">Status</span>
                  {canEdit ? (
                    <StatusPicker
                      assignmentId={assignment.id}
                      status={assignment.status as Status}
                      role={role(session)}
                    />
                  ) : (
                    <Badge bg={meta.bg} fg={meta.fg}>
                      {meta.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-muted)]">
                    Planned date
                  </span>
                  <span className="font-medium text-[var(--color-ink)] tabular-nums">
                    {assignment.preferredDate?.toISOString().slice(0, 10) ?? "—"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[var(--color-ink-muted)]">Key pickup</span>
                  <span className="text-right font-medium text-[var(--color-ink)]">
                    {assignment.requiresKeyPickup
                      ? assignment.keyPickupLocationType === "other"
                        ? assignment.keyPickupAddress
                          ? assignment.keyPickupAddress
                          : "Other address"
                        : "At office"
                      : "Not required"}
                  </span>
                </div>
              </CardBody>
            </Card>

            {commission && (
              <Card>
                <CardHeader>
                  <CardTitle>Commission</CardTitle>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                    Applied at completion. Snapshotted — retroactive rate
                    changes don&apos;t rewrite this line.
                  </p>
                </CardHeader>
                <CardBody className="space-y-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[var(--color-ink-soft)]">Rate</span>
                    <span className="font-medium text-[var(--color-ink)] tabular-nums">
                      {formatCommissionRate(
                        commission.commissionType,
                        commission.commissionValue,
                      )}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-[var(--color-border)] pt-2">
                    <span className="text-sm font-semibold text-[var(--color-ink)]">
                      Earned
                    </span>
                    <span className="text-base font-semibold text-[var(--color-ink)] tabular-nums">
                      {formatEuros(commission.commissionAmountCents)}
                    </span>
                  </div>
                </CardBody>
              </Card>
            )}

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
                  <DownloadAssignmentPdfButton assignmentId={assignment.id} />
                </div>
              </CardBody>
            </Card>

            <AssignedToCard
              services={services.map((svc) => ({
                key: svc.key,
                label: svc.label,
                short: svc.short,
                color: svc.color,
              }))}
              initialSelectedServiceKeys={assignment.services.map(
                (s) => s.serviceKey,
              )}
              freelancers={freelancers}
              initialFreelancerId={assignment.freelancer?.id ?? null}
              canEdit={canFreelancer && !terminal}
            />

            {/* Owner + tenant cards under the form would feel duplicative
                (the form already shows them, editable or disabled). Keep
                them as a quick-glance summary card next to scheduling for
                anyone navigating the sidebar. */}
            <Card>
              <CardHeader>
                <CardTitle>Owner</CardTitle>
              </CardHeader>
              <CardBody className="space-y-2 text-sm">
                <p className="font-medium text-[var(--color-ink)]">
                  {assignment.ownerName}
                </p>
                {assignment.ownerEmail && (
                  <a
                    href={`mailto:${assignment.ownerEmail}`}
                    className="flex items-center gap-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                  >
                    <IconMail size={14} />
                    {assignment.ownerEmail}
                  </a>
                )}
                {assignment.ownerPhone && (
                  <a
                    href={`tel:${assignment.ownerPhone}`}
                    className="flex items-center gap-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                  >
                    <IconPhone size={14} />
                    {assignment.ownerPhone}
                  </a>
                )}
              </CardBody>
            </Card>

            {assignment.tenantName && (
              <Card>
                <CardHeader>
                  <CardTitle>Tenant</CardTitle>
                </CardHeader>
                <CardBody className="space-y-2 text-sm">
                  <p className="font-medium text-[var(--color-ink)]">
                    {assignment.tenantName}
                  </p>
                  {assignment.tenantEmail && (
                    <a
                      href={`mailto:${assignment.tenantEmail}`}
                      className="flex items-center gap-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                    >
                      <IconMail size={14} />
                      {assignment.tenantEmail}
                    </a>
                  )}
                  {assignment.tenantPhone && (
                    <a
                      href={`tel:${assignment.tenantPhone}`}
                      className="flex items-center gap-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                    >
                      <IconPhone size={14} />
                      {assignment.tenantPhone}
                    </a>
                  )}
                </CardBody>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
