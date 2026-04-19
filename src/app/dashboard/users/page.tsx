import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/Icons";
import { USERS } from "@/lib/mockData";

const roleBadge: Record<string, { bg: string; fg: string }> = {
  admin: { bg: "#fef2f2", fg: "#b91c1c" },
  staff: { bg: "#f5f3ff", fg: "#6d28d9" },
  realtor: { bg: "#eff6ff", fg: "#1d4ed8" },
  freelancer: { bg: "#ecfdf5", fg: "#047857" },
};

export default function UsersPage() {
  return (
    <>
      <Topbar title="Users" subtitle={`${USERS.length} people`} />

      <div className="p-8 max-w-[1400px]">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <button className="rounded-md border border-[var(--color-border-strong)] bg-white px-3 py-1.5 text-sm font-medium">
              All
            </button>
            {["admin", "staff", "realtor", "freelancer"].map((r) => (
              <button
                key={r}
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] capitalize"
              >
                {r}
              </button>
            ))}
          </div>
          <Button size="sm">
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
                  <th className="text-left font-semibold px-6 py-3">Status</th>
                  <th className="text-right font-semibold px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {USERS.map((u) => {
                  const rb = roleBadge[u.role] ?? roleBadge.freelancer;
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-[var(--color-bg-alt)]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar initials={u.avatar} size="md" online={u.online} />
                          <div>
                            <p className="font-medium text-[var(--color-ink)]">{u.name}</p>
                            <p className="text-xs text-[var(--color-ink-muted)]">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge bg={rb.bg} fg={rb.fg}>
                          <span className="capitalize">{u.role}</span>
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-[var(--color-ink-soft)]">{u.team}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)]">
                          <span
                            className={`h-2 w-2 rounded-full ${u.online ? "bg-[var(--color-epc)]" : "bg-[var(--color-ink-faint)]"}`}
                          />
                          {u.online ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                          Edit
                        </button>
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
