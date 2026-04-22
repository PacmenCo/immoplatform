import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManageAnnouncements } from "@/lib/permissions";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconMegaphone } from "@/components/ui/Icons";
import { DeleteAnnouncementButton } from "../DeleteAnnouncementButton";

type Type = "info" | "success" | "warning" | "danger";

const TYPE_STYLES: Record<Type, { bg: string; fg: string; label: string }> = {
  info:    { bg: "#eff6ff", fg: "#1d4ed8", label: "Info" },
  success: { bg: "#ecfdf5", fg: "#047857", label: "Success" },
  warning: { bg: "#fef3c7", fg: "#b45309", label: "Warning" },
  danger:  { bg: "#fef2f2", fg: "#b91c1c", label: "Danger" },
};

function statusOf(a: { isActive: boolean; startsAt: Date; endsAt: Date }) {
  if (!a.isActive) return { label: "Inactive", bg: "#f1f5f9", fg: "#475569" };
  const now = Date.now();
  if (a.startsAt.getTime() > now) return { label: "Scheduled", bg: "#fef3c7", fg: "#b45309" };
  if (a.endsAt.getTime() < now) return { label: "Expired",   bg: "#fee2e2", fg: "#991b1b" };
  return { label: "Active", bg: "#dcfce7", fg: "#15803d" };
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!canManageAnnouncements(session)) {
    redirect("/no-access?section=announcements");
  }

  const { id } = await params;
  const a = await prisma.announcement.findUnique({
    where: { id },
    include: {
      createdBy: { select: { firstName: true, lastName: true, email: true } },
      _count: { select: { dismissals: true } },
    },
  });
  if (!a) notFound();

  const t = TYPE_STYLES[a.type as Type] ?? TYPE_STYLES.info;
  const s = statusOf(a);
  const creator = a.createdBy
    ? `${a.createdBy.firstName} ${a.createdBy.lastName}`
    : "System";

  return (
    <>
      <Topbar title={a.title} subtitle="Announcement details" />

      <div className="p-8 max-w-[820px] space-y-6">
        <div className="flex items-center justify-end gap-2">
          <Button href={`/dashboard/announcements/${a.id}/edit`} variant="secondary" size="sm">
            Edit
          </Button>
          <DeleteAnnouncementButton
            id={a.id}
            title={a.title}
            redirectTo="/dashboard/announcements"
          />
        </div>

        <Card>
          <CardBody>
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-md"
                style={{ backgroundColor: t.bg, color: t.fg }}
              >
                <IconMegaphone size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-semibold text-[var(--color-ink)]">{a.title}</h1>
                  <Badge bg={t.bg} fg={t.fg}>{t.label}</Badge>
                  <Badge bg={s.bg} fg={s.fg}>{s.label}</Badge>
                  {!a.isDismissible && <Badge>Sticky</Badge>}
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-[var(--color-ink-soft)]">
                  {a.body}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timing &amp; visibility</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">Active window</dt>
                <dd className="mt-1 text-[var(--color-ink)]">
                  {formatDateTime(a.startsAt)} → {formatDateTime(a.endsAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">Published</dt>
                <dd className="mt-1 text-[var(--color-ink)]">{a.isActive ? "Yes" : "Draft"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">Dismissible</dt>
                <dd className="mt-1 text-[var(--color-ink)]">
                  {a.isDismissible ? `Yes · ${a._count.dismissals} dismissed` : "No (sticky)"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">Author</dt>
                <dd className="mt-1 text-[var(--color-ink)]">{creator}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">Created</dt>
                <dd className="mt-1 text-[var(--color-ink)]">{formatDateTime(a.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">Last updated</dt>
                <dd className="mt-1 text-[var(--color-ink)]">{formatDateTime(a.updatedAt)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
