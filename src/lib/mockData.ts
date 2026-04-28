export const SERVICE_KEYS = ["epc", "asbestos", "electrical", "fuel"] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

export const SERVICES: Record<
  ServiceKey,
  { label: string; short: string; color: string; description: string }
> = {
  epc: {
    label: "Energy Performance Certificate",
    short: "EPC",
    color: "var(--color-epc)",
    description: "Legally required energy rating for every sale or rental.",
  },
  asbestos: {
    label: "Asbestos Inventory Attest",
    short: "AIV",
    color: "var(--color-asbestos)",
    description: "Mandatory asbestos inventory for buildings from before 2001.",
  },
  electrical: {
    label: "Electrical Inspection",
    short: "EK",
    color: "var(--color-electrical)",
    description: "AREI installation inspection for safe electrical systems.",
  },
  fuel: {
    label: "Fuel Tank Check",
    short: "TK",
    color: "var(--color-fuel)",
    description: "Periodic inspection for above-ground and buried fuel tanks.",
  },
};

// Order matches Platform's lifecycle: new → awaiting → scheduled → in progress →
// delivered → completed, with on_hold as a pause state and cancelled terminal.
export type Status =
  | "draft"
  | "awaiting"
  | "scheduled"
  | "in_progress"
  | "delivered"
  | "completed"
  | "on_hold"
  | "cancelled";

// Status pill tints. We mix a status-specific hue with the theme's bg/ink
// CSS vars, so the same `bg`/`fg` strings render correctly in both light
// and dark mode without forking the consumer API. v1 parity (Platform's
// Flux Badge resolves to dark-mode-aware tokens via DB-stored `color`); v2
// reaches the same outcome via color-mix + CSS vars.
function statusTint(hue: string) {
  return {
    bg: `color-mix(in srgb, ${hue} 14%, var(--color-bg))`,
    fg: `color-mix(in srgb, ${hue} 60%, var(--color-ink))`,
  };
}

export const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", ...statusTint("#64748b") },        // slate
  awaiting: { label: "Awaiting", ...statusTint("#475569") },  // slate-darker
  scheduled: { label: "Scheduled", ...statusTint("#3b82f6") }, // blue
  in_progress: { label: "In progress", ...statusTint("#f59e0b") }, // amber
  delivered: { label: "Delivered", ...statusTint("#22c55e") }, // green
  completed: { label: "Completed", ...statusTint("#84cc16") }, // lime
  on_hold: { label: "On hold", ...statusTint("#71717a") },    // zinc
  cancelled: { label: "Cancelled", ...statusTint("#ef4444") }, // red
};

/**
 * Canonical left-to-right order used by every list, filter, picker, and
 * enum — single source of truth keeps UI and validator in lockstep.
 */
export const STATUS_ORDER = [
  "draft",
  "awaiting",
  "scheduled",
  "in_progress",
  "delivered",
  "completed",
  "on_hold",
  "cancelled",
] as const satisfies readonly Status[];

export const TERMINAL_STATUSES = ["completed", "cancelled"] as const satisfies readonly Status[];

export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export type Assignment = {
  id: string;
  reference: string;
  address: string;
  city: string;
  postal: string;
  status: Status;
  services: ServiceKey[];
  preferredDate: string;
  createdAt: string;
  owner: { name: string; email: string; phone: string };
  tenant?: { name: string; email: string; phone: string };
  team: string;
  freelancer?: { name: string; avatar: string };
  notes?: string;
};

export const ASSIGNMENTS: Assignment[] = [
  {
    id: "a_1001",
    reference: "ASG-2026-1001",
    address: "Meir 34",
    city: "Antwerpen",
    postal: "2000",
    status: "scheduled",
    services: ["epc", "asbestos"],
    preferredDate: "2026-04-25",
    createdAt: "2026-04-15",
    owner: { name: "Els Vermeulen", email: "els@example.com", phone: "+32 476 12 34 56" },
    tenant: { name: "Marc De Smet", email: "marc@example.com", phone: "+32 479 98 76 54" },
    team: "Vastgoed Antwerp",
    freelancer: { name: "Tim De Vos", avatar: "TV" },
  },
  {
    id: "a_1002",
    reference: "ASG-2026-1002",
    address: "Place Sainte-Gudule 12",
    city: "Brussels",
    postal: "1000",
    status: "in_progress",
    services: ["asbestos", "electrical", "fuel"],
    preferredDate: "2026-04-20",
    createdAt: "2026-04-12",
    owner: { name: "Pierre Dubois", email: "pierre@example.com", phone: "+32 472 11 22 33" },
    team: "Immo Bruxelles",
    freelancer: { name: "Sofie Janssens", avatar: "SJ" },
  },
  {
    id: "a_1003",
    reference: "ASG-2026-1003",
    address: "Sint-Pietersnieuwstraat 45",
    city: "Gent",
    postal: "9000",
    status: "delivered",
    services: ["epc"],
    preferredDate: "2026-04-10",
    createdAt: "2026-04-02",
    owner: { name: "Hannah Peeters", email: "hannah@example.com", phone: "+32 478 55 44 33" },
    team: "Gent Huizen",
    freelancer: { name: "Dieter Claes", avatar: "DC" },
  },
  {
    id: "a_1004",
    reference: "ASG-2026-1004",
    address: "Grote Markt 7",
    city: "Mechelen",
    postal: "2800",
    status: "completed",
    services: ["epc", "asbestos", "electrical", "fuel"],
    preferredDate: "2026-03-28",
    createdAt: "2026-03-20",
    owner: { name: "Jef Wouters", email: "jef@example.com", phone: "+32 475 33 22 11" },
    tenant: { name: "Lisa Maes", email: "lisa@example.com", phone: "+32 471 22 11 00" },
    team: "Mechelen Makelaars",
    freelancer: { name: "Nele Willems", avatar: "NW" },
  },
  {
    id: "a_1005",
    reference: "ASG-2026-1005",
    address: "Rue Neuve 88",
    city: "Liège",
    postal: "4000",
    status: "draft",
    services: ["asbestos"],
    preferredDate: "2026-05-02",
    createdAt: "2026-04-18",
    owner: { name: "Julien Lambert", email: "julien@example.com", phone: "+32 497 44 55 66" },
    team: "Immo Liège",
  },
  {
    id: "a_1006",
    reference: "ASG-2026-1006",
    address: "Vrijdagmarkt 12",
    city: "Brugge",
    postal: "8000",
    status: "scheduled",
    services: ["epc", "fuel"],
    preferredDate: "2026-04-28",
    createdAt: "2026-04-16",
    owner: { name: "Annelies Martens", email: "annelies@example.com", phone: "+32 478 77 88 99" },
    team: "Brugge Vastgoed",
    freelancer: { name: "Tim De Vos", avatar: "TV" },
  },
];

export const TEAMS = [
  { id: "t_01", name: "Vastgoed Antwerp", city: "Antwerpen", members: 12, active: 47, logo: "VA", color: "#0f172a" },
  { id: "t_02", name: "Immo Bruxelles", city: "Brussels", members: 8, active: 29, logo: "IB", color: "#1e40af" },
  { id: "t_03", name: "Gent Huizen", city: "Gent", members: 5, active: 18, logo: "GH", color: "#0d9488" },
  { id: "t_04", name: "Mechelen Makelaars", city: "Mechelen", members: 3, active: 9, logo: "MM", color: "#9f1239" },
  { id: "t_05", name: "Immo Liège", city: "Liège", members: 6, active: 21, logo: "IL", color: "#b45309" },
  { id: "t_06", name: "Brugge Vastgoed", city: "Brugge", members: 4, active: 14, logo: "BV", color: "#6d28d9" },
];

export type UserRole = "admin" | "staff" | "realtor" | "freelancer";

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  team: string;
  avatar: string;
  online: boolean;
  joined: string;
  region?: string;
  specialties?: ServiceKey[];
  bio?: string;
};

export const USERS: User[] = [
  {
    id: "u_1",
    name: "Jordan Remy",
    email: "jordan@asbestexperts.be",
    phone: "+32 474 00 11 22",
    role: "admin",
    team: "—",
    avatar: "JR",
    online: true,
    joined: "2026-01-04",
    region: "Belgium (all regions)",
    bio: "Platform admin. Handles onboarding, price lists and Odoo integration.",
  },
  {
    id: "u_2",
    name: "Els Vermeulen",
    email: "els@vastgoedantwerp.be",
    phone: "+32 476 12 34 56",
    role: "realtor",
    team: "Vastgoed Antwerp",
    avatar: "EV",
    online: true,
    joined: "2026-02-11",
    region: "Antwerp",
    bio: "Managing broker at Vastgoed Antwerp — 34 active listings.",
  },
  {
    id: "u_3",
    name: "Tim De Vos",
    email: "tim@immo.be",
    phone: "+32 478 98 12 33",
    role: "freelancer",
    team: "—",
    avatar: "TV",
    online: false,
    joined: "2026-01-18",
    region: "Antwerp · Mechelen",
    specialties: ["asbestos", "epc"],
    bio: "Certified asbestos inspector (OVAM). 12 years of field experience.",
  },
  {
    id: "u_4",
    name: "Sofie Janssens",
    email: "sofie@immo.be",
    phone: "+32 479 44 55 66",
    role: "freelancer",
    team: "—",
    avatar: "SJ",
    online: true,
    joined: "2026-02-02",
    region: "Brussels",
    specialties: ["asbestos", "electrical", "fuel"],
    bio: "Multi-service inspector. Specialises in mixed-use and commercial properties.",
  },
  {
    id: "u_5",
    name: "Dieter Claes",
    email: "dieter@immo.be",
    phone: "+32 475 11 22 33",
    role: "freelancer",
    team: "—",
    avatar: "DC",
    online: false,
    joined: "2026-03-07",
    region: "Gent · East Flanders",
    specialties: ["epc"],
    bio: "EPC specialist. Fast turnaround, focus on single-family homes.",
  },
  {
    id: "u_6",
    name: "Pierre Dubois",
    email: "pierre@immobruxelles.be",
    phone: "+32 472 33 44 55",
    role: "realtor",
    team: "Immo Bruxelles",
    avatar: "PD",
    online: true,
    joined: "2026-02-20",
    region: "Brussels",
    bio: "Lead broker at Immo Bruxelles. Primary point of contact for our Brussels agency.",
  },
  {
    id: "u_7",
    name: "Nele Willems",
    email: "nele@immo.be",
    phone: "+32 477 22 33 44",
    role: "freelancer",
    team: "—",
    avatar: "NW",
    online: false,
    joined: "2026-03-15",
    region: "Mechelen · Leuven",
    specialties: ["fuel", "electrical"],
    bio: "Specialises in fuel-tank and electrical inspections, including buried tanks.",
  },
  {
    id: "u_8",
    name: "Marie Lefevre",
    email: "marie@immo.be",
    phone: "+32 471 99 88 77",
    role: "staff",
    team: "—",
    avatar: "ML",
    online: true,
    joined: "2026-01-12",
    region: "Belgium",
    bio: "Customer success. Main contact for agency onboarding and support.",
  },
];

export type PendingInvite = {
  id: string;
  email: string;
  role: UserRole;
  teamId?: string;
  teamRole?: "owner" | "member";
  invitedBy: string;
  sentAt: string;
};

export const PENDING_INVITES: PendingInvite[] = [
  {
    id: "inv_01",
    email: "lucas.mertens@vastgoedantwerp.be",
    role: "realtor",
    teamId: "t_01",
    teamRole: "member",
    invitedBy: "Jordan Remy",
    sentAt: "2026-04-18",
  },
  {
    id: "inv_02",
    email: "sarah.dewitte@gmail.com",
    role: "freelancer",
    invitedBy: "Marie Lefevre",
    sentAt: "2026-04-17",
  },
  {
    id: "inv_03",
    email: "anna@gent-huizen.be",
    role: "realtor",
    teamId: "t_03",
    teamRole: "owner",
    invitedBy: "Jordan Remy",
    sentAt: "2026-04-15",
  },
];

export type CommissionStatus = "pending" | "approved" | "paid" | "on_hold";

export type CommissionLine = {
  id: string;
  teamId: string;
  period: string; // YYYY-MM
  assignmentsCount: number;
  grossRevenue: number;
  commissionPercent: number;
  commissionAmount: number;
  status: CommissionStatus;
  paidAt?: string;
  paidRef?: string;
};

export const COMMISSIONS: CommissionLine[] = [
  { id: "c_01", teamId: "t_01", period: "2026-04", assignmentsCount: 18, grossRevenue: 9420, commissionPercent: 15, commissionAmount: 1413, status: "pending" },
  { id: "c_02", teamId: "t_02", period: "2026-04", assignmentsCount: 12, grossRevenue: 6100, commissionPercent: 15, commissionAmount: 915, status: "approved" },
  { id: "c_03", teamId: "t_03", period: "2026-04", assignmentsCount: 9, grossRevenue: 4280, commissionPercent: 15, commissionAmount: 642, status: "paid", paidAt: "2026-04-05", paidRef: "PAY-2026-0412" },
  { id: "c_04", teamId: "t_04", period: "2026-04", assignmentsCount: 4, grossRevenue: 2010, commissionPercent: 15, commissionAmount: 301, status: "pending" },
  { id: "c_05", teamId: "t_05", period: "2026-04", assignmentsCount: 7, grossRevenue: 2320, commissionPercent: 15, commissionAmount: 348, status: "on_hold" },
  { id: "c_06", teamId: "t_06", period: "2026-04", assignmentsCount: 3, grossRevenue: 720, commissionPercent: 15, commissionAmount: 108, status: "paid", paidAt: "2026-04-03", paidRef: "PAY-2026-0411" },
  // March
  { id: "c_07", teamId: "t_01", period: "2026-03", assignmentsCount: 22, grossRevenue: 11240, commissionPercent: 15, commissionAmount: 1686, status: "paid", paidAt: "2026-03-05", paidRef: "PAY-2026-0310" },
  { id: "c_08", teamId: "t_02", period: "2026-03", assignmentsCount: 14, grossRevenue: 7130, commissionPercent: 15, commissionAmount: 1069, status: "paid", paidAt: "2026-03-05", paidRef: "PAY-2026-0311" },
];

export type IntegrationKey = "google_calendar" | "outlook_calendar" | "odoo" | "email_provider" | "eenvoudig_factureren";

export type Integration = {
  key: IntegrationKey;
  name: string;
  vendor: string;
  description: string;
  connected: boolean;
  lastSyncAt?: string;
  errorCount?: number;
  scope?: "personal" | "org";
};

export const INTEGRATIONS: Integration[] = [
  {
    key: "google_calendar",
    name: "Google Calendar",
    vendor: "Google",
    description: "Push assignment dates into each team's calendar.",
    connected: true,
    lastSyncAt: "2026-04-19 09:42",
    errorCount: 0,
    scope: "personal",
  },
  {
    key: "outlook_calendar",
    name: "Outlook Calendar",
    vendor: "Microsoft",
    description: "Push assignment dates into Outlook / Microsoft 365.",
    connected: false,
    scope: "personal",
  },
  {
    key: "odoo",
    name: "Odoo",
    vendor: "Odoo S.A.",
    description: "Sync invoices, products and contacts into the Odoo ERP.",
    connected: true,
    lastSyncAt: "2026-04-19 08:15",
    errorCount: 3,
    scope: "org",
  },
  {
    key: "email_provider",
    name: "Email provider",
    vendor: "Postmark",
    description: "Transactional email for invites, assignment updates, reminders.",
    connected: true,
    lastSyncAt: "2026-04-19 09:48",
    errorCount: 0,
    scope: "org",
  },
  {
    key: "eenvoudig_factureren",
    name: "Eenvoudig Factureren",
    vendor: "Eenvoudig",
    description: "Belgian invoicing — auto-create customer invoices per assignment.",
    connected: false,
    scope: "org",
  },
];

export const DASHBOARD_STATS = [
  { label: "Active assignments", value: "47", delta: "+12%" },
  { label: "Due this week", value: "8", delta: "3 today" },
  { label: "Revenue (MTD)", value: "€ 24,850", delta: "+18%" },
  { label: "Avg. turnaround", value: "4.2 d", delta: "-0.3 d" },
];

export const RECENT_ACTIVITY = [
  { who: "Tim De Vos", what: "delivered", ref: "ASG-2026-1003", when: "12 min ago", kind: "delivered" as const },
  { who: "Els Vermeulen", what: "created", ref: "ASG-2026-1007", when: "1 hr ago", kind: "created" as const },
  { who: "Sofie Janssens", what: "scheduled", ref: "ASG-2026-1002", when: "3 hr ago", kind: "scheduled" as const },
  { who: "Nele Willems", what: "uploaded files for", ref: "ASG-2026-1004", when: "yesterday", kind: "files" as const },
  { who: "System", what: "sent invoice for", ref: "March 2026", when: "2 days ago", kind: "invoice" as const },
];
