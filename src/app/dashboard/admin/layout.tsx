import { requireRoleOrRedirect } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(["admin", "staff"], "admin");
  return <>{children}</>;
}
