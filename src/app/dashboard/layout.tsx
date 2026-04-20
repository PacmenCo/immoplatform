import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileTopbar } from "@/components/dashboard/MobileTopbar";
import { getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
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
