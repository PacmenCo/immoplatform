import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { localeRedirect } from "@/i18n/navigation";
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

const TYPE_STYLES: Record<Type, { bg: string; fg: string }> = {
  info:    { bg: "#eff6ff", fg: "#1d4ed8" },
  success: { bg: "#ecfdf5", fg: "#047857" },
  warning: { bg: "#fef3c7", fg: "#b45309" },
  danger:  { bg: "#fef2f2", fg: "#b91c1c" },
};

type StatusKey = "active" | "scheduled" | "expired" | "inactive";

const STATUS_STYLES: Record<StatusKey, { bg: string; fg: string }> = {
  active:    { bg: "#dcfce7", fg: "#15803d" },
  scheduled: { bg: "#fef3c7", fg: "#b45309" },
  expired:   { bg: "#fee2e2", fg: "#991b1b" },
  inactive:  { bg: "#f1f5f9", fg: "#475569" },
};

function statusKeyOf(a: { isActive: boolean; startsAt: Date; endsAt: Date }): StatusKey {
  if (!a.isActive) return "inactive";
  const now = Date.now();
  if (a.startsAt.getTime() > now) return "scheduled";
  if (a.endsAt.getTime() < now) return "expired";
  return "active";
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
    await localeRedirect("/no-access?section=announcements");
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

  const t = await getTranslations("dashboard.announcements");

  const typeKey = (["info", "success", "warning", "danger"] as const).includes(
    a.type as never,
  )
    ? (a.type as Type)
    : "info";
  const ts = TYPE_STYLES[typeKey];
  const statusKey = statusKeyOf(a);
  const ss = STATUS_STYLES[statusKey];
  const creator = a.createdBy
    ? `${a.createdBy.firstName} ${a.createdBy.lastName}`
    : t("meta.systemAuthor");

  return (
    <>
      <Topbar title={a.title} subtitle={t("detail.subtitle")} />

      <div className="p-8 max-w-[820px] space-y-6">
        <div className="flex items-center justify-end gap-2">
          <Button href={`/dashboard/announcements/${a.id}/edit`} variant="secondary" size="sm">
            {t("actions.edit")}
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
                style={{ backgroundColor: ts.bg, color: ts.fg }}
              >
                <IconMegaphone size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-semibold text-[var(--color-ink)]">{a.title}</h1>
                  <Badge bg={ts.bg} fg={ts.fg}>{t(`types.${typeKey}`)}</Badge>
                  <Badge bg={ss.bg} fg={ss.fg}>{t(`status.${statusKey}`)}</Badge>
                  {!a.isDismissible && <Badge>{t("meta.sticky")}</Badge>}
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
            <CardTitle>{t("detail.timing.title")}</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">{t("detail.timing.activeWindow")}</dt>
                <dd className="mt-1 text-[var(--color-ink)]">
                  {t("detail.timing.activeWindowValue", {
                    start: formatDateTime(a.startsAt),
                    end: formatDateTime(a.endsAt),
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">{t("detail.timing.published")}</dt>
                <dd className="mt-1 text-[var(--color-ink)]">{a.isActive ? t("detail.timing.publishedYes") : t("detail.timing.publishedDraft")}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">{t("detail.timing.dismissible")}</dt>
                <dd className="mt-1 text-[var(--color-ink)]">
                  {a.isDismissible
                    ? t("detail.timing.dismissibleYes", { count: a._count.dismissals })
                    : t("detail.timing.dismissibleNo")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">{t("detail.timing.author")}</dt>
                <dd className="mt-1 text-[var(--color-ink)]">{creator}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">{t("detail.timing.created")}</dt>
                <dd className="mt-1 text-[var(--color-ink)]">{formatDateTime(a.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">{t("detail.timing.lastUpdated")}</dt>
                <dd className="mt-1 text-[var(--color-ink)]">{formatDateTime(a.updatedAt)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
