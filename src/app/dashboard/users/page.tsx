import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconPlus, IconArrowRight } from "@/components/ui/Icons";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import {
  canAdminUsers,
  hasRole,
  userListRoleFilter,
} from "@/lib/permissions";
import { initials } from "@/lib/format";
import { roleBadge } from "@/lib/roleColors";
import { isOnline } from "@/lib/userStatus";
import { SearchInput } from "@/components/dashboard/SearchInput";
import type { Prisma } from "@prisma/client";
import { PendingInvitesPanel } from "./PendingInvitesPanel";
import { DeleteUserButton } from "./DeleteUserButton";

type SearchParams = Promise<{ role?: string; q?: string }>;

// Cap user-supplied search terms so the LIKE parameters stay small.
const MAX_QUERY_LEN = 120;

const ROLE_FILTERS = ["admin", "staff", "realtor", "freelancer"] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

function isRoleFilter(v: string | undefined): v is RoleFilter {
  return (ROLE_FILTERS as readonly string[]).includes(v ?? "");
}

function relativeTime(from: Date | null, now: Date): string {
  if (!from) return "Never";
  const diffMs = now.getTime() - from.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon}mo ago`;
  return `${Math.floor(mon / 12)}y ago`;
}

export const metadata = { title: "Users" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  if (!hasRole(session, "admin", "staff")) {
    redirect("/no-access?section=users");
  }

  const params = await searchParams;
  const activeRole: RoleFilter | null = isRoleFilter(params.role) ? params.role : null;
  const q = (params.q ?? "").trim().slice(0, MAX_QUERY_LEN);

  // Platform parity (UserController.php:42-46): staff cannot see admins or
  // other staff. Applied to both the user table and the pending-invites list.
  const roleFilter = userListRoleFilter(session);
  // The role filter hides the viewer's own row if their role is in the
  // excluded set (e.g. staff looking at the list won't see themselves).
  // Add a self-exception so "me" is always visible in the user list.
  const usersRoleFilter = roleFilter
    ? { OR: [{ id: session.user.id }, roleFilter] }
    : undefined;
  const activeRoleWhere = activeRole ? { role: activeRole } : {};

  // Platform parity (UsersList.php:122-127): whitespace-split AND, each word
  // substring-matches firstName, lastName or email. `mode: "insensitive"`
  // matches v1 MySQL LIKE collation on Postgres (without it, "tim" wouldn't
  // match "Tim").
  const words = q.split(/\s+/).filter(Boolean);
  const searchWhere: Prisma.UserWhereInput | undefined = words.length
    ? {
        AND: words.map((w) => ({
          OR: [
            { firstName: { contains: w, mode: "insensitive" } },
            { lastName: { contains: w, mode: "insensitive" } },
            { email: { contains: w, mode: "insensitive" } },
          ],
        })),
      }
    : undefined;

  const [users, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(usersRoleFilter ?? {}),
        ...activeRoleWhere,
        ...(searchWhere ?? {}),
      },
      orderBy: { joinedAt: "asc" },
      include: {
        memberships: {
          include: { team: { select: { name: true } } },
        },
      },
    }),
    prisma.invite.findMany({
      where: {
        acceptedAt: null,
        revokedAt: null,
        ...(roleFilter ?? {}),
        ...activeRoleWhere,
        // Invites have only email to match against, but respecting `q` keeps
        // the list and the invites card in lockstep — a search for a name
        // won't match, but a search for a partial email will.
        ...(words.length
          ? { AND: words.map((w) => ({ email: { contains: w, mode: "insensitive" as const } })) }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        team: { select: { name: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const canAdmin = canAdminUsers(session);
  const now = new Date();
  const nowMs = now.getTime();

  return (
    <>
      <Topbar title="Users" subtitle={`${users.length} people`} />

      <div className="p-8 max-w-[1400px] space-y-6">
        {pendingInvites.length > 0 && (
          <PendingInvitesPanel
            canInvite={hasRole(session, "admin")}
            invites={pendingInvites.map((inv) => ({
              id: inv.id,
              email: inv.email,
              role: inv.role,
              roleBadge: roleBadge(inv.role),
              teamName: inv.team?.name ?? null,
              teamRole: inv.teamRole,
              invitedBy: `${inv.invitedBy.firstName} ${inv.invitedBy.lastName}`,
              sentAt: inv.createdAt.toISOString().slice(0, 10),
            }))}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/users"
              className={
                "rounded-md border px-3 py-1.5 text-sm transition-colors " +
                (activeRole === null
                  ? "border-[var(--color-border-strong)] bg-[var(--color-bg)] font-medium text-[var(--color-ink)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]")
              }
            >
              All
            </Link>
            {ROLE_FILTERS.map((r) => {
              // Staff viewers have admin/staff filtered out at the DB level; hide
              // those buttons too so clicking them doesn't yield an empty list.
              if (!hasRole(session, "admin") && (r === "admin" || r === "staff")) {
                return null;
              }
              const active = activeRole === r;
              return (
                <Link
                  key={r}
                  href={`/dashboard/users?role=${r}`}
                  className={
                    "rounded-md border px-3 py-1.5 text-sm capitalize transition-colors " +
                    (active
                      ? "border-[var(--color-border-strong)] bg-[var(--color-bg)] font-medium text-[var(--color-ink)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]")
                  }
                >
                  {r}
                </Link>
              );
            })}
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <SearchInput
              initialQuery={q}
              placeholder="Search by name or email…"
            />
            {hasRole(session, "admin") && (
              <Button href="/dashboard/users/invite" size="sm">
                <IconPlus size={14} />
                Invite user
              </Button>
            )}
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <th scope="col" className="text-left font-semibold px-6 py-3">User</th>
                  <th scope="col" className="text-left font-semibold px-6 py-3">Role</th>
                  <th scope="col" className="text-left font-semibold px-6 py-3">Team</th>
                  <th scope="col" className="text-left font-semibold px-6 py-3">Joined</th>
                  <th scope="col" className="text-left font-semibold px-6 py-3">Last seen</th>
                  <th scope="col" className="text-right font-semibold px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {users.map((u) => {
                  const rb = roleBadge(u.role);
                  const teamName = u.memberships[0]?.team.name ?? "—";
                  const fullName = `${u.firstName} ${u.lastName}`;
                  const canDelete = canAdmin && u.id !== session.user.id;
                  const online = isOnline(u, nowMs);
                  return (
                    <tr
                      key={u.id}
                      className="group transition-colors hover:bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
                    >
                      <td className="px-6 py-3">
                        <Link
                          href={`/dashboard/users/${u.id}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar initials={initials(u.firstName, u.lastName)} size="md" />
                          <div>
                            <p className="font-medium text-[var(--color-ink)] group-hover:underline">
                              {fullName}
                            </p>
                            <p className="text-xs text-[var(--color-ink-muted)]">
                              {u.email}
                            </p>
                          </div>
                        </Link>
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
                      <td className="px-6 py-3 text-sm text-[var(--color-ink-muted)] tabular-nums">
                        {online ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-[#047857]">
                            <span
                              aria-hidden
                              className="inline-block h-2 w-2 rounded-full bg-[#10b981]"
                            />
                            Online
                          </span>
                        ) : (
                          relativeTime(u.lastSeenAt, now)
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {canDelete ? (
                            <DeleteUserButton userId={u.id} userName={fullName} />
                          ) : null}
                          <Link
                            href={`/dashboard/users/${u.id}`}
                            aria-label={`View ${fullName}`}
                            className="inline-flex items-center text-[var(--color-ink-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-ink-soft)]"
                          >
                            <IconArrowRight size={14} />
                          </Link>
                        </div>
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
