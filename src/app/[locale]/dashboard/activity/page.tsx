import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localeRedirect } from "@/i18n/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/EmptyState";
import { initials } from "@/lib/format";

// Max rows shown without paginator — 200 is enough to see "recent" activity
// without triggering a big row read on every page visit. Wiring filter +
// pagination is a follow-up task (CC todo); the disabled placeholder UI was
// removed because it looked broken to admins.
const ROW_LIMIT = 200;

type Kind = "auth" | "create" | "update" | "status" | "delete" | "system";

const KIND_STYLES: Record<Kind, { bg: string; fg: string }> = {
  auth: { bg: "#eff6ff", fg: "#1d4ed8" },
  create: { bg: "#ecfdf5", fg: "#047857" },
  update: { bg: "#fef3c7", fg: "#b45309" },
  status: { bg: "#f1f5f9", fg: "#334155" },
  delete: { bg: "#fee2e2", fg: "#b91c1c" },
  system: { bg: "#ede9fe", fg: "#5b21b6" },
};

// Verb → kind classifier. Keeps the mapping near the UI so it can evolve
// without touching the AuditVerb union in lib/auth.ts. New verbs default
// to "update" — visible but unsurprising — which is the right failure mode
// if someone adds a verb and forgets to list it here.
function classifyVerb(verb: string): Kind {
  if (verb.startsWith("auth.")) return "auth";
  if (
    verb === "user.signed_in" ||
    verb === "user.signed_out" ||
    verb === "user.password_changed" ||
    verb === "user.email_verified" ||
    verb === "user.email_verification_sent" ||
    verb === "password_reset.requested"
  ) {
    return "auth";
  }
  if (
    verb.endsWith(".deleted") ||
    verb.endsWith(".removed") ||
    verb.endsWith(".revoked") ||
    verb.endsWith(".dismissed") ||
    verb === "user.sessions_revoked" ||
    verb === "user.avatar_removed"
  ) {
    return "delete";
  }
  if (
    verb.endsWith(".created") ||
    verb.endsWith(".sent") ||
    verb.endsWith(".accepted") ||
    verb === "assignment.file_uploaded" ||
    verb === "user.avatar_uploaded" ||
    verb === "assignment.pdf_generated"
  ) {
    return "create";
  }
  if (
    verb === "assignment.started" ||
    verb === "assignment.delivered" ||
    verb === "assignment.completed" ||
    verb === "assignment.cancelled" ||
    verb === "assignment.reassigned" ||
    verb === "assignment.commission_applied" ||
    verb === "commission.quarter_paid" ||
    verb === "commission.quarter_unpaid" ||
    verb === "team.ownership_transferred" ||
    verb === "user.role_changed"
  ) {
    return "status";
  }
  if (verb.startsWith("invoice_reminder.")) return "system";
  return "update";
}

// "assignment.file_uploaded" → "Assignment file uploaded"
function humanizeVerb(verb: string): string {
  const parts = verb.split(".");
  const sentence = parts.join(" ").replace(/_/g, " ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function formatStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function targetLabel(row: {
  objectType: string | null;
  objectId: string | null;
}): string {
  if (!row.objectType && !row.objectId) return "—";
  if (row.objectType && row.objectId) return `${row.objectType} · ${row.objectId}`;
  return row.objectType ?? row.objectId ?? "—";
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.pageTitles");
  return { title: t("activity") };
}

export default async function ActivityLogPage() {
  const session = await requireSession();
  // Admin-only parity with the earlier "staff + admin see global activity"
  // convention used by canViewUser / canEditAnnouncement. Freelancers +
  // realtors see their own per-object audit via assignment detail pages.
  if (!hasRole(session, "admin", "staff")) {
    await localeRedirect("/no-access?section=admin");
  }

  const t = await getTranslations("dashboard.activity");

  const rows = await prisma.auditLog.findMany({
    orderBy: { at: "desc" },
    take: ROW_LIMIT,
    select: {
      id: true,
      at: true,
      verb: true,
      objectType: true,
      objectId: true,
      actor: {
        select: { firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });

  return (
    <>
      <Topbar
        title={t("topbar.title")}
        subtitle={t("topbar.subtitle", { count: rows.length })}
      />

      <div className="p-8 max-w-[1400px] space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("card.title")}</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {rows.length === 0 ? (
              <EmptyState
                title={t("empty.title")}
                description={t("empty.description")}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium">{t("table.timestamp")}</th>
                      <th className="px-6 py-3 text-left font-medium">{t("table.actor")}</th>
                      <th className="px-6 py-3 text-left font-medium">{t("table.action")}</th>
                      <th className="px-6 py-3 text-left font-medium">{t("table.target")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const kind = classifyVerb(r.verb);
                      const style = KIND_STYLES[kind];
                      const actorName = r.actor
                        ? `${r.actor.firstName} ${r.actor.lastName}`
                        : t("actor.system");
                      const actorInitials = r.actor
                        ? initials(r.actor.firstName, r.actor.lastName)
                        : "SY";
                      return (
                        <tr key={r.id} className="border-t border-[var(--color-border)]">
                          <td className="px-6 py-3 font-mono text-xs text-[var(--color-ink-soft)] whitespace-nowrap">
                            {formatStamp(r.at)}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar
                                initials={actorInitials}
                                size="xs"
                                imageUrl={r.actor?.avatarUrl ?? null}
                              />
                              <span className="text-[var(--color-ink)]">{actorName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <Badge bg={style.bg} fg={style.fg}>
                                {t(`kinds.${kind}`)}
                              </Badge>
                              <span className="text-[var(--color-ink-soft)]">
                                {humanizeVerb(r.verb)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3 font-mono text-xs text-[var(--color-ink-soft)]">
                            {targetLabel(r)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
