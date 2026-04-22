import Link from "next/link";
import { redirect } from "next/navigation";
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

const TYPE_STYLES: Record<Type, { bg: string; fg: string; label: string }> = {
  info:    { bg: "#eff6ff", fg: "#1d4ed8", label: "Info" },
  success: { bg: "#ecfdf5", fg: "#047857", label: "Success" },
  warning: { bg: "#fef3c7", fg: "#b45309", label: "Warning" },
  danger:  { bg: "#fef2f2", fg: "#b91c1c", label: "Danger" },
};

function statusOf(a: { isActive: boolean; startsAt: Date; endsAt: Date }): {
  label: string;
  bg: string;
  fg: string;
} {
  if (!a.isActive) return { label: "Inactive", bg: "#f1f5f9", fg: "#475569" };
  const now = Date.now();
  if (a.startsAt.getTime() > now) return { label: "Scheduled", bg: "#fef3c7", fg: "#b45309" };
  if (a.endsAt.getTime() < now) return { label: "Expired",   bg: "#fee2e2", fg: "#991b1b" };
  return { label: "Active", bg: "#dcfce7", fg: "#15803d" };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AnnouncementsPage() {
  const session = await requireSession();
  if (!canManageAnnouncements(session)) {
    redirect("/no-access?section=announcements");
  }

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  return (
    <>
      <Topbar title="Announcements" subtitle="Banner messages shown to users" />

      <div className="p-8 max-w-[1000px] space-y-6">
        <div className="flex items-center justify-end">
          <Button href="/dashboard/announcements/new" size="sm">
            <IconPlus size={14} />
            New announcement
          </Button>
        </div>

        {announcements.length === 0 ? (
          <EmptyState
            icon={<IconMegaphone size={24} />}
            title="No announcements yet"
            description="Publish a banner to let everyone on the platform know about updates, maintenance, or new features."
            action={
              <Button href="/dashboard/announcements/new" size="sm">
                <IconPlus size={14} />
                New announcement
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {announcements.map((a) => {
              const t = TYPE_STYLES[a.type as Type] ?? TYPE_STYLES.info;
              const s = statusOf(a);
              const creator = a.createdBy
                ? `${a.createdBy.firstName} ${a.createdBy.lastName}`
                : "System";
              return (
                <Card key={a.id} className="overflow-hidden">
                  <div className="flex items-start gap-4 p-6">
                    <span
                      aria-hidden
                      className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-md"
                      style={{ backgroundColor: t.bg, color: t.fg }}
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
                        <Badge bg={t.bg} fg={t.fg}>{t.label}</Badge>
                        <Badge bg={s.bg} fg={s.fg}>{s.label}</Badge>
                        {!a.isDismissible && <Badge>Sticky</Badge>}
                      </div>
                      <p className="mt-2 text-sm text-[var(--color-ink-soft)] line-clamp-2">
                        {a.body}
                      </p>
                      <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
                        {formatDate(a.startsAt)} → {formatDate(a.endsAt)} · by {creator}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        href={`/dashboard/announcements/${a.id}/edit`}
                        variant="secondary"
                        size="sm"
                      >
                        Edit
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
