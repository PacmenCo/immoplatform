import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileTopbar } from "@/components/dashboard/MobileTopbar";
import { getSession } from "@/lib/auth";
import { avatarImageUrl } from "@/lib/avatar";
import { initials } from "@/lib/format";
import { getUserTeamIds, hasRole } from "@/lib/permissions";

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
      />
      <div className="flex-1 min-w-0">
        <MobileTopbar />
        {children}
      </div>
    </div>
  );
}
