import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { IconFilter, IconSearch } from "@/components/ui/Icons";

type Row = {
  timestamp: string;
  actorName: string;
  actorInitials: string;
  action: string;
  kind: "auth" | "create" | "update" | "status" | "delete" | "system";
  target: string;
  ip: string;
};

const ROWS: Row[] = [
  { timestamp: "2026-04-18 09:41:12", actorName: "Jordan Remy", actorInitials: "JR", action: "Logged in", kind: "auth", target: "—", ip: "91.183.24.12" },
  { timestamp: "2026-04-18 09:38:55", actorName: "Els Vermeulen", actorInitials: "EV", action: "Created assignment", kind: "create", target: "ASG-2026-1007", ip: "81.244.88.3" },
  { timestamp: "2026-04-18 09:14:02", actorName: "Tim De Vos", actorInitials: "TV", action: "Updated status to delivered", kind: "status", target: "ASG-2026-1003", ip: "193.121.44.78" },
  { timestamp: "2026-04-18 08:57:30", actorName: "Sofie Janssens", actorInitials: "SJ", action: "Uploaded report file", kind: "update", target: "ASG-2026-1002", ip: "81.83.110.2" },
  { timestamp: "2026-04-17 18:22:10", actorName: "Marie Lefevre", actorInitials: "ML", action: "Updated team branding", kind: "update", target: "t_02 · Immo Bruxelles", ip: "91.183.24.12" },
  { timestamp: "2026-04-17 16:05:48", actorName: "System", actorInitials: "SY", action: "Generated monthly invoices", kind: "system", target: "March 2026 batch", ip: "—" },
  { timestamp: "2026-04-17 14:41:09", actorName: "Pierre Dubois", actorInitials: "PD", action: "Invited user", kind: "create", target: "u_new · lucas@immobruxelles.be", ip: "81.244.88.3" },
  { timestamp: "2026-04-17 13:12:55", actorName: "Jordan Remy", actorInitials: "JR", action: "Changed commission rate to 15%", kind: "update", target: "t_04 · Mechelen Makelaars", ip: "91.183.24.12" },
  { timestamp: "2026-04-17 11:02:17", actorName: "Nele Willems", actorInitials: "NW", action: "Marked scheduled", kind: "status", target: "ASG-2026-1006", ip: "81.83.110.2" },
  { timestamp: "2026-04-17 09:08:44", actorName: "Dieter Claes", actorInitials: "DC", action: "Logged in", kind: "auth", target: "—", ip: "193.121.44.78" },
  { timestamp: "2026-04-16 22:41:01", actorName: "System", actorInitials: "SY", action: "Nightly Odoo sync completed", kind: "system", target: "sync_20260416", ip: "—" },
  { timestamp: "2026-04-16 17:15:33", actorName: "Jordan Remy", actorInitials: "JR", action: "Archived announcement", kind: "delete", target: "an_3 · Commission payout delayed", ip: "91.183.24.12" },
  { timestamp: "2026-04-16 15:03:19", actorName: "Els Vermeulen", actorInitials: "EV", action: "Updated owner contact", kind: "update", target: "ASG-2026-1001", ip: "81.244.88.3" },
  { timestamp: "2026-04-16 10:48:02", actorName: "Tim De Vos", actorInitials: "TV", action: "Failed login", kind: "auth", target: "—", ip: "193.121.44.78" },
  { timestamp: "2026-04-16 09:22:11", actorName: "Jordan Remy", actorInitials: "JR", action: "Published announcement", kind: "create", target: "an_2 · New electrical inspection", ip: "91.183.24.12" },
];

const KIND_STYLES: Record<Row["kind"], { bg: string; fg: string; label: string }> = {
  auth: { bg: "#eff6ff", fg: "#1d4ed8", label: "Auth" },
  create: { bg: "#ecfdf5", fg: "#047857", label: "Create" },
  update: { bg: "#fef3c7", fg: "#b45309", label: "Update" },
  status: { bg: "#f1f5f9", fg: "#334155", label: "Status" },
  delete: { bg: "#fee2e2", fg: "#b91c1c", label: "Delete" },
  system: { bg: "#ede9fe", fg: "#5b21b6", label: "System" },
};

export default function ActivityLogPage() {
  return (
    <>
      <Topbar title="Activity log" subtitle={`${ROWS.length} recent events`} />

      <div className="p-8 max-w-[1400px] space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Filter events</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-muted)]" />
              <Input placeholder="Search by user, target or IP…" className="pl-9" />
            </div>
            <Select defaultValue="all">
              <option value="all">All event types</option>
              <option value="auth">Auth</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="status">Status</option>
              <option value="delete">Delete</option>
              <option value="system">System</option>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="date" defaultValue="2026-04-16" />
              <span className="text-sm text-[var(--color-ink-muted)]">→</span>
              <Input type="date" defaultValue="2026-04-18" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Events</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm"><IconFilter size={14} />Saved views</Button>
              <Button variant="secondary" size="sm">Export CSV</Button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Timestamp</th>
                  <th className="px-6 py-3 text-left font-medium">Actor</th>
                  <th className="px-6 py-3 text-left font-medium">Action</th>
                  <th className="px-6 py-3 text-left font-medium">Target</th>
                  <th className="px-6 py-3 text-left font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => {
                  const k = KIND_STYLES[r.kind];
                  return (
                    <tr key={i} className="border-t border-[var(--color-border)]">
                      <td className="px-6 py-3 font-mono text-xs text-[var(--color-ink-soft)] whitespace-nowrap">{r.timestamp}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar initials={r.actorInitials} size="xs" />
                          <span className="text-[var(--color-ink)]">{r.actorName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Badge bg={k.bg} fg={k.fg}>{k.label}</Badge>
                          <span className="text-[var(--color-ink-soft)]">{r.action}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-[var(--color-ink-soft)]">{r.target}</td>
                      <td className="px-6 py-3 font-mono text-xs text-[var(--color-ink-muted)]">{r.ip}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
