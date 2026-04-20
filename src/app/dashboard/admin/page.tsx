import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody } from "@/components/ui/Card";
import {
  IconList,
  IconUsers,
  IconBuilding,
  IconMegaphone,
  IconChart,
  IconArrowRight,
  IconSettings,
  IconWallet,
  IconMail,
  IconPlug,
} from "@/components/ui/Icons";

const CARDS = [
  {
    href: "/dashboard/admin/price-list",
    icon: IconList,
    title: "Price list",
    description: "Master list of services, unit prices and Odoo mapping.",
    accent: "var(--color-epc)",
  },
  {
    href: "/dashboard/users",
    icon: IconUsers,
    title: "User management",
    description: "Invite staff, realtors and freelancers; set roles and access.",
    accent: "var(--color-fuel)",
  },
  {
    href: "/dashboard/teams",
    icon: IconBuilding,
    title: "Team management",
    description: "Partner offices, branding, members and commission rules.",
    accent: "var(--color-brand)",
  },
  {
    href: "/dashboard/announcements",
    icon: IconMegaphone,
    title: "Announcements",
    description: "Publish banner messages to the entire platform.",
    accent: "var(--color-electrical)",
  },
  {
    href: "/dashboard/activity",
    icon: IconChart,
    title: "Activity log",
    description: "Full audit trail of logins, mutations and status changes.",
    accent: "var(--color-asbestos)",
  },
  {
    href: "/dashboard/commissions",
    icon: IconWallet,
    title: "Commissions & payouts",
    description: "Per-team balance, approve and mark payouts, commission rules.",
    accent: "#15803d",
  },
  {
    href: "/dashboard/admin/invoice-reminders",
    icon: IconMail,
    title: "Invoice reminders",
    description: "Monthly balance email schedule, recipients, manual triggers.",
    accent: "#b45309",
  },
  {
    href: "/dashboard/settings/integrations",
    icon: IconPlug,
    title: "Integrations",
    description: "Odoo sync status, calendar connections, email provider.",
    accent: "#6d28d9",
  },
  {
    href: "/dashboard/admin/exports",
    icon: IconSettings,
    title: "Data exports",
    description: "Download CSVs of assignments, payouts, teams and users.",
    accent: "var(--color-ink-soft)",
  },
];

export default function AdminHubPage() {
  return (
    <>
      <Topbar title="Admin" subtitle="Platform configuration and operations" />

      <div className="p-8 max-w-[1400px]">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-semibold text-[var(--color-ink)]">Control panel</h2>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">Admin-only tools for configuring the platform, managing access and reviewing activity. Choose a section below.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href} className="group">
              <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-md)]">
                <CardBody>
                  <div className="flex items-start justify-between">
                    <span
                      className="grid h-10 w-10 place-items-center rounded-md"
                      style={{ backgroundColor: `color-mix(in srgb, ${c.accent} 14%, var(--color-bg))`, color: c.accent }}
                    >
                      <c.icon size={18} />
                    </span>
                    <IconArrowRight size={16} className="text-[var(--color-ink-faint)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--color-ink)]" />
                  </div>
                  <h3 className="mt-4 font-semibold text-[var(--color-ink)] group-hover:underline">{c.title}</h3>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{c.description}</p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
