import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canAdminUsers } from "@/lib/permissions";
import { UserEditForm } from "./UserEditForm";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!canAdminUsers(session)) {
    redirect("/no-access?section=users");
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      deletedAt: true,
    },
  });
  if (!user || user.deletedAt) notFound();

  return (
    <>
      <Topbar
        title={`Edit ${user.firstName} ${user.lastName}`}
        subtitle="Admin user management"
      />

      <div className="p-8 max-w-[960px] space-y-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          <Link href="/dashboard/users" className="hover:text-[var(--color-ink)]">
            Users
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/dashboard/users/${user.id}`} className="hover:text-[var(--color-ink)]">
            {user.firstName} {user.lastName}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[var(--color-ink-soft)]">Edit</span>
        </nav>

        <UserEditForm
          initial={{
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
          }}
        />
      </div>
    </>
  );
}
