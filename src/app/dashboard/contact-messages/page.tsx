import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconMail, IconCheck } from "@/components/ui/Icons";
import { ContactSubmissionRow } from "./ContactSubmissionRow";

export const metadata = { title: "Contact messages" };

type SearchParams = Promise<{ show?: string }>;

export default async function ContactMessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  if (!hasRole(session, "admin")) {
    redirect("/no-access?section=admin");
  }

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
        title="Contact messages"
        subtitle={
          totalCount === 0
            ? "Visitor submissions from the public /contact form will land here."
            : `${totalCount} total · ${unhandledCount} awaiting reply`
        }
      />

      <div className="p-8 max-w-[1200px] space-y-6">
        {totalCount === 0 ? (
          <Card className="p-12">
            <EmptyState
              title="No messages yet"
              description="When someone submits the contact form on immoplatform.be, the message will show up here."
              icon={<IconMail size={32} className="text-[var(--color-ink-muted)]" />}
            />
          </Card>
        ) : (
          <>
            <FilterTabs
              showUnhandled={showUnhandled}
              totalCount={totalCount}
              unhandledCount={unhandledCount}
            />

            {submissions.length === 0 ? (
              <Card className="p-12">
                <EmptyState
                  title="Inbox zero"
                  description="Every message has been handled. Switch to All to see the full history."
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
}: {
  showUnhandled: boolean;
  totalCount: number;
  unhandledCount: number;
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Filter messages"
    >
      <FilterPill
        href="/dashboard/contact-messages"
        active={!showUnhandled}
        label="All"
        count={totalCount}
      />
      <FilterPill
        href="/dashboard/contact-messages?show=unhandled"
        active={showUnhandled}
        label="Awaiting reply"
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
