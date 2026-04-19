import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileTopbar } from "@/components/dashboard/MobileTopbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--color-bg-alt)]">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <MobileTopbar />
        {children}
      </div>
    </div>
  );
}
