import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileTopbar } from "@/components/dashboard/MobileTopbar";
import { getSession } from "@/lib/auth";
import { avatarImageUrl } from "@/lib/avatar";
import { prisma } from "@/lib/db";
import { initials } from "@/lib/format";
import { getUserTeamIds, hasRole } from "@/lib/permissions";
import { BRAND_NAME } from "@/lib/site";

// Per-page titles. Pages set their own `export const metadata` and Next slots
// the value into `%s`. Without the template every dashboard route inherited
// the marketing default — bad for tab-switcher orientation + screen readers.
export const metadata: Metadata = {
  title: { template: `%s · ${BRAND_NAME}`, default: `Dashboard · ${BRAND_NAME}` },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Realtor-needs-team gate. Admins & staff bypass; freelancers are allowed
  // without a team (they may work independently). getUserTeamIds is cached,
  // so child pages that inspect memberships reuse this result.
  if (hasRole(session, "realtor")) {
    const { all } = await getUserTeamIds(session.user.id);
    if (all.length === 0) redirect("/no-team");
  }

  const user = session.user;

  // Unread contact-message badge — admin-only feature, so we skip the query
  // entirely for non-admins (other roles can't see the Messages nav item).
  const unreadContactCount = hasRole(session, "admin")
    ? await prisma.contactSubmission.count({ where: { handledAt: null } })
    : undefined;

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-alt)]">
      <Sidebar
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatarInitials: initials(user.firstName, user.lastName),
          avatarUrl: avatarImageUrl(user),
        }}
        unreadContactCount={unreadContactCount}
      />
      <div className="flex-1 min-w-0">
        <MobileTopbar />
        {/* SkipLink in src/components/layout targets `#main`. Wrapping
            children (not the mobile topbar) in <main> skips both the
            sidebar AND the mobile burger nav. */}
        <main id="main">{children}</main>
      </div>
    </div>
  );
}
