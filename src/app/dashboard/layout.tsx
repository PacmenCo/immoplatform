import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileTopbar } from "@/components/dashboard/MobileTopbar";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Realtor-needs-team gate. Admins & staff bypass (they act on every team).
  // Freelancers are allowed without a team — they may work independently.
  if (hasRole(session, "realtor")) {
    const count = await prisma.teamMember.count({
      where: { userId: session.user.id },
    });
    if (count === 0) redirect("/no-team");
  }

  const user = session.user;

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-alt)]">
      <Sidebar
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatarInitials:
            (user.firstName[0] ?? "") + (user.lastName[0] ?? ""),
        }}
      />
      <div className="flex-1 min-w-0">
        <MobileTopbar />
        {children}
      </div>
    </div>
  );
}
