import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  IconSearch,
  IconHome,
  IconList,
  IconBuilding,
  IconChart,
  IconSettings,
  IconArrowRight,
  IconMail,
} from "@/components/ui/Icons";

type Article = { title: string; description: string };
type Category = { id: string; icon: React.ComponentType<{ size?: number; className?: string }>; title: string; accent: string; articles: Article[] };

const CATEGORIES: Category[] = [
  {
    id: "getting-started",
    icon: IconHome,
    title: "Getting started",
    accent: "var(--color-brand)",
    articles: [
      { title: "Welcome to Immo", description: "A guided tour of the dashboard and where to find each section." },
      { title: "Setting up your profile", description: "Photo, contact info, notification preferences and signature." },
      { title: "Inviting your first team member", description: "Roles, permissions and how invites arrive by email." },
      { title: "Connecting your Odoo instance", description: "Link product mappings and invoice templates." },
      { title: "Keyboard shortcuts", description: "Speed up your workflow with cmd-K, cmd-N and more." },
      { title: "Troubleshooting login issues", description: "Two-factor, magic links and session expiry." },
    ],
  },
  {
    id: "assignments",
    icon: IconList,
    title: "Assignments",
    accent: "var(--color-epc)",
    articles: [
      { title: "Creating an assignment", description: "Required fields, scheduling preferences and attachments." },
      { title: "Assigning to a freelancer", description: "Match skills, availability and distance to site." },
      { title: "Status flow explained", description: "Draft → scheduled → in progress → delivered → completed." },
      { title: "Uploading report files", description: "File types, automatic OCR and Odoo sync behavior." },
      { title: "Handling cancellations", description: "Refund rules and rescheduling best practices." },
      { title: "Bulk actions", description: "Update status or team for many assignments at once." },
    ],
  },
  {
    id: "teams",
    icon: IconBuilding,
    title: "Teams",
    accent: "var(--color-fuel)",
    articles: [
      { title: "Team roles and permissions", description: "Admin, realtor, freelancer and staff — what each can see." },
      { title: "Branding a team", description: "Logo, signature, legal details and billing address." },
      { title: "Per-team price overrides", description: "When to override the master price list and how it appears on invoices." },
      { title: "Commission configuration", description: "Percentage vs fixed amount, and payout cadence." },
      { title: "Archiving a team", description: "What happens to ongoing assignments and historical data." },
      { title: "Transferring assignments between teams", description: "Bulk reassignment and audit trail implications." },
    ],
  },
  {
    id: "billing",
    icon: IconChart,
    title: "Billing",
    accent: "var(--color-electrical)",
    articles: [
      { title: "Monthly invoice generation", description: "Schedule, preview and approval workflow." },
      { title: "Reading a commission payout", description: "Gross, commission share, deductions and net." },
      { title: "Updating VAT and billing details", description: "Changes propagate to future invoices only." },
      { title: "Exporting accounting data", description: "CSV formats and recommended import into Odoo." },
      { title: "Handling invoice disputes", description: "Credit notes and partial refunds." },
      { title: "SEPA direct debit setup", description: "Mandate flow, retries and failed-payment handling." },
    ],
  },
  {
    id: "api",
    icon: IconSettings,
    title: "API",
    accent: "var(--color-asbestos)",
    articles: [
      { title: "Generating an API key", description: "Scopes, rotation and the shell environment variable to set." },
      { title: "Authentication", description: "Bearer tokens, rate limits and IP allow-lists." },
      { title: "Assignments endpoints", description: "List, create, update and attach files programmatically." },
      { title: "Webhook events", description: "Subscribing to status changes and delivery retries." },
      { title: "Pagination and filtering", description: "Cursor-based pagination with practical examples." },
      { title: "Error handling", description: "Status codes, machine-readable error bodies and idempotency keys." },
    ],
  },
];

export default function HelpPage() {
  return (
    <>
      <Topbar title="Help center" subtitle="Guides, answers and how-tos" />

      <div className="p-8 max-w-[1200px] space-y-8">
        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-ink)]">How can we help, Jordan?</h2>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Search our guides or browse by category below.</p>
            </div>
            <div className="relative max-w-2xl">
              <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-muted)]" />
              <Input placeholder="Search help articles, e.g. ‘invite a freelancer’" className="h-11 pl-10 text-base" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[var(--color-ink-muted)]">Popular:</span>
              {["Invite member", "Commission rules", "Odoo sync", "Status flow"].map((t) => (
                <Link key={t} href="#" className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-1 text-[var(--color-ink-soft)] hover:border-[var(--color-ink-soft)]">
                  {t}
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>

        <nav className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c) => (
            <Link key={c.id} href={`#${c.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-[var(--color-ink-soft)]">
                <CardBody className="flex flex-col items-start gap-3">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-md"
                    style={{ backgroundColor: `color-mix(in srgb, ${c.accent} 14%, white)`, color: c.accent }}
                  >
                    <c.icon size={18} />
                  </span>
                  <div>
                    <div className="font-semibold text-[var(--color-ink)]">{c.title}</div>
                    <div className="text-xs text-[var(--color-ink-muted)]">{c.articles.length} articles</div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </nav>

        {CATEGORIES.map((c) => (
          <section key={c.id} id={c.id}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-8 w-8 place-items-center rounded-md"
                    style={{ backgroundColor: `color-mix(in srgb, ${c.accent} 14%, white)`, color: c.accent }}
                  >
                    <c.icon size={16} />
                  </span>
                  <CardTitle>{c.title}</CardTitle>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                <ul className="divide-y divide-[var(--color-border)]">
                  {c.articles.map((a, i) => (
                    <li key={i}>
                      <Link href="#" className="flex items-start justify-between gap-4 px-6 py-4 hover:bg-[var(--color-bg-alt)]">
                        <div className="min-w-0">
                          <h4 className="font-medium text-[var(--color-ink)]">{a.title}</h4>
                          <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">{a.description}</p>
                        </div>
                        <IconArrowRight size={16} className="mt-1 shrink-0 text-[var(--color-ink-faint)]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </section>
        ))}

        <Card className="bg-[var(--color-bg-alt)]">
          <CardBody className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-white text-[var(--color-ink-soft)]">
                <IconMail size={18} />
              </span>
              <div>
                <div className="font-semibold text-[var(--color-ink)]">Still stuck?</div>
                <div className="text-sm text-[var(--color-ink-muted)]">Our support team replies within 4 business hours.</div>
              </div>
            </div>
            <Button size="sm">Contact support</Button>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
