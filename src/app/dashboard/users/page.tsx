import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
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
import { PendingInviteRow } from "./PendingInviteRow";
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
  // substring-matches firstName, lastName or email. SQLite's default LIKE is
  // case-insensitive for ASCII, which matches Platform's MySQL default
  // collation — no `mode: "insensitive"` needed (and it's unsupported on
  // SQLite anyway). Same pattern as assignments/page.tsx.
  const words = q.split(/\s+/).filter(Boolean);
  const searchWhere: Prisma.UserWhereInput | undefined = words.length
    ? {
        AND: words.map((w) => ({
          OR: [
            { firstName: { contains: w } },
            { lastName: { contains: w } },
            { email: { contains: w } },
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
                const rb = roleBadge(inv.role);
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
            <Button href="/dashboard/users/invite" size="sm">
              <IconPlus size={14} />
              Invite user
            </Button>
          </div>
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
                  <th className="text-left font-semibold px-6 py-3">Last seen</th>
                  <th className="text-right font-semibold px-6 py-3" />
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
