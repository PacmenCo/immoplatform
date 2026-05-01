import { requireRoleOrRedirect } from "@/lib/auth";

// v1 parity — `Platform/routes/web.php:103-127` wraps `/admin/*` in
// `Route::middleware(['role:admin'])`. Staff (medewerker) had read
// access to /users in v1 but no write access to admin tooling. v2
// previously allowed staff in here; tightened to match.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(["admin"], "admin");
  return <>{children}</>;
}
