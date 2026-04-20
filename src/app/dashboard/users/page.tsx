import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconPlus, IconArrowRight, IconMail } from "@/components/ui/Icons";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { PendingInviteRow } from "./PendingInviteRow";

const roleBadge: Record<string, { bg: string; fg: string }> = {
  admin: { bg: "#fef2f2", fg: "#b91c1c" },
  staff: { bg: "#f5f3ff", fg: "#6d28d9" },
  realtor: { bg: "#eff6ff", fg: "#1d4ed8" },
  freelancer: { bg: "#ecfdf5", fg: "#047857" },
};

function initials(first: string, last: string): string {
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "??";
}

export default async function UsersPage() {
  const session = await requireSession();
  if (!hasRole(session, "admin", "staff")) {
    redirect("/no-access?section=users");
  }

  const [users, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { joinedAt: "asc" },
      include: {
        memberships: {
          include: { team: { select: { name: true } } },
        },
      },
    }),
    prisma.invite.findMany({
      where: { acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        team: { select: { name: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return (
    <>
      <Topbar title="Users" subtitle={`${users.length} people`} />

      <div className="p-8 max-w-[1400px] space-y-6">
        {pendingInvites.length > 0 && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Pending invites</CardTitle>
                <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                  {pendingInvites.length} invite
                  {pendingInvites.length === 1 ? "" : "s"} awaiting acceptance
                </p>
              </div>
              <Button href="/dashboard/users/invite" variant="secondary" size="sm">
                <IconPlus size={14} />
                Invite user
              </Button>
            </CardHeader>
            <ul className="divide-y divide-[var(--color-border)]">
              {pendingInvites.map((inv) => {
                const rb = roleBadge[inv.role] ?? roleBadge.freelancer;
                const inviter = `${inv.invitedBy.firstName} ${inv.invitedBy.lastName}`;
                return (
                  <PendingInviteRow
                    key={inv.id}
                    inviteId={inv.id}
                    email={inv.email}
                    role={inv.role}
                    roleBadge={rb}
                    teamName={inv.team?.name ?? null}
                    teamRole={inv.teamRole}
                    invitedBy={inviter}
                    sentAt={inv.createdAt.toISOString().slice(0, 10)}
                  />
                );
              })}
            </ul>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-1.5 text-sm font-medium">
              All
            </button>
            {["admin", "staff", "realtor", "freelancer"].map((r) => (
              <button
                key={r}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] capitalize"
              >
                {r}
              </button>
            ))}
          </div>
          <Button href="/dashboard/users/invite" size="sm">
            <IconPlus size={14} />
            Invite user
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <th className="text-left font-semibold px-6 py-3">User</th>
                  <th className="text-left font-semibold px-6 py-3">Role</th>
                  <th className="text-left font-semibold px-6 py-3">Team</th>
                  <th className="text-left font-semibold px-6 py-3">Joined</th>
                  <th className="text-right font-semibold px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {users.map((u) => {
                  const rb = roleBadge[u.role] ?? roleBadge.freelancer;
                  const teamName = u.memberships[0]?.team.name ?? "—";
                  const fullName = `${u.firstName} ${u.lastName}`;
                  return (
                    <tr
                      key={u.id}
                      className="group cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
                    >
                      <td className="relative px-6 py-3">
                        <Link
                          href={`/dashboard/users/${u.id}`}
                          className="absolute inset-0"
                          aria-label={`View ${fullName}`}
                        />
                        <div className="flex items-center gap-3">
                          <Avatar initials={initials(u.firstName, u.lastName)} size="md" />
                          <div>
                            <p className="font-medium text-[var(--color-ink)] group-hover:underline">
                              {fullName}
                            </p>
                            <p className="text-xs text-[var(--color-ink-muted)]">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <Badge bg={rb.bg} fg={rb.fg}>
                          <span className="capitalize">{u.role}</span>
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-sm text-[var(--color-ink-soft)]">
                        {teamName}
                      </td>
                      <td className="px-6 py-3 text-sm text-[var(--color-ink-muted)] tabular-nums">
                        {u.joinedAt.toISOString().slice(0, 10)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <IconArrowRight
                          size={14}
                          className="inline-block text-[var(--color-ink-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-ink-soft)]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
