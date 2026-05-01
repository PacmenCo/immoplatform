import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { localeRedirect } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconMail, IconCheck } from "@/components/ui/Icons";
import { ContactSubmissionRow } from "./ContactSubmissionRow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.pageTitles");
  return { title: t("contactMessages") };
}

type SearchParams = Promise<{ show?: string }>;

export default async function ContactMessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  if (!hasRole(session, "admin")) {
    await localeRedirect("/no-access?section=admin");
  }

  const t = await getTranslations("dashboard.contactMessages");

  const sp = await searchParams;
  const showUnhandled = sp.show === "unhandled";

  // Cap at 200 — low volume; filter in memory so the count pills always
  // reflect totals regardless of which view is active.
  const allSubmissions = await prisma.contactSubmission.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      handledBy: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  const totalCount = allSubmissions.length;
  const unhandledCount = allSubmissions.filter(
    (s) => s.handledAt === null,
  ).length;
  const submissions = showUnhandled
    ? allSubmissions.filter((s) => s.handledAt === null)
    : allSubmissions;

  return (
    <>
      <Topbar
        title={t("topbar.title")}
        subtitle={
          totalCount === 0
            ? t("topbar.subtitleEmpty")
            : t("topbar.subtitleCount", {
                total: totalCount,
                unhandled: unhandledCount,
              })
        }
      />

      <div className="p-8 max-w-[1200px] space-y-6">
        {totalCount === 0 ? (
          <Card className="p-12">
            <EmptyState
              title={t("empty.title")}
              description={t("empty.description")}
              icon={<IconMail size={32} className="text-[var(--color-ink-muted)]" />}
            />
          </Card>
        ) : (
          <>
            <FilterTabs
              showUnhandled={showUnhandled}
              totalCount={totalCount}
              unhandledCount={unhandledCount}
              labelAriaLabel={t("filterTabs.ariaLabel")}
              labelAll={t("filterTabs.all")}
              labelUnhandled={t("filterTabs.unhandled")}
            />

            {submissions.length === 0 ? (
              <Card className="p-12">
                <EmptyState
                  title={t("empty.inboxZeroTitle")}
                  description={t("empty.inboxZeroDescription")}
                  icon={
                    <IconCheck
                      size={32}
                      className="text-[var(--color-ink-muted)]"
                    />
                  }
                />
              </Card>
            ) : (
              <ul className="space-y-4">
                {submissions.map((s) => (
                  <li key={s.id}>
                    <ContactSubmissionRow
                      submission={{
                        id: s.id,
                        createdAt: s.createdAt.toISOString(),
                        name: s.name,
                        email: s.email,
                        phone: s.phone,
                        subject: s.subject,
                        message: s.message,
                        ipAddress: s.ipAddress,
                        handledAt: s.handledAt ? s.handledAt.toISOString() : null,
                        handledByName: s.handledBy
                          ? `${s.handledBy.firstName} ${s.handledBy.lastName}`
                          : null,
                        notes: s.notes,
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}

function FilterTabs({
  showUnhandled,
  totalCount,
  unhandledCount,
  labelAriaLabel,
  labelAll,
  labelUnhandled,
}: {
  showUnhandled: boolean;
  totalCount: number;
  unhandledCount: number;
  labelAriaLabel: string;
  labelAll: string;
  labelUnhandled: string;
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label={labelAriaLabel}
    >
      <FilterPill
        href="/dashboard/contact-messages"
        active={!showUnhandled}
        label={labelAll}
        count={totalCount}
      />
      <FilterPill
        href="/dashboard/contact-messages?show=unhandled"
        active={showUnhandled}
        label={labelUnhandled}
        count={unhandledCount}
      />
    </div>
  );
}

function FilterPill({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors " +
        (active
          ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]"
          : "bg-[var(--color-bg-muted)] text-[var(--color-ink-soft)] hover:bg-[var(--color-border)] hover:text-[var(--color-ink)]")
      }
    >
      {label}
      <span
        className={
          "rounded-full px-1.5 text-xs " +
          (active
            ? "bg-[color-mix(in_srgb,var(--color-on-brand)_20%,transparent)] text-[var(--color-on-brand)]"
            : "bg-[var(--color-bg)] text-[var(--color-ink-muted)]")
        }
      >
        {count}
      </span>
    </Link>
  );
}
