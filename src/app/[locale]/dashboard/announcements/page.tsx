import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { localeRedirect } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManageAnnouncements } from "@/lib/permissions";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconPlus, IconMegaphone } from "@/components/ui/Icons";
import { DeleteAnnouncementButton } from "./DeleteAnnouncementButton";

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

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AnnouncementsPage() {
  const session = await requireSession();
  if (!canManageAnnouncements(session)) {
    await localeRedirect("/no-access?section=announcements");
  }

  const t = await getTranslations("dashboard.announcements");

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  return (
    <>
      <Topbar title={t("topbar.title")} subtitle={t("topbar.subtitle")} />

      <div className="p-8 max-w-[1000px] space-y-6">
        <div className="flex items-center justify-end">
          <Button href="/dashboard/announcements/new" size="sm">
            <IconPlus size={14} />
            {t("actions.new")}
          </Button>
        </div>

        {announcements.length === 0 ? (
          <EmptyState
            icon={<IconMegaphone size={24} />}
            title={t("empty.title")}
            description={t("empty.description")}
            action={
              <Button href="/dashboard/announcements/new" size="sm">
                <IconPlus size={14} />
                {t("actions.new")}
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {announcements.map((a) => {
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
                <Card key={a.id} className="overflow-hidden">
                  <div className="flex items-start gap-4 p-6">
                    <span
                      aria-hidden
                      className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-md"
                      style={{ backgroundColor: ts.bg, color: ts.fg }}
                    >
                      <IconMegaphone size={18} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Link
                          href={`/dashboard/announcements/${a.id}`}
                          className="font-semibold text-[var(--color-ink)] hover:underline"
                        >
                          {a.title}
                        </Link>
                        <Badge bg={ts.bg} fg={ts.fg}>{t(`types.${typeKey}`)}</Badge>
                        <Badge bg={ss.bg} fg={ss.fg}>{t(`status.${statusKey}`)}</Badge>
                        {!a.isDismissible && <Badge>{t("meta.sticky")}</Badge>}
                      </div>
                      <p className="mt-2 text-sm text-[var(--color-ink-soft)] line-clamp-2">
                        {a.body}
                      </p>
                      <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
                        {t("meta.rangeWithCreator", {
                          start: formatDate(a.startsAt),
                          end: formatDate(a.endsAt),
                          creator,
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        href={`/dashboard/announcements/${a.id}/edit`}
                        variant="secondary"
                        size="sm"
                      >
                        {t("actions.edit")}
                      </Button>
                      <DeleteAnnouncementButton id={a.id} title={a.title} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
