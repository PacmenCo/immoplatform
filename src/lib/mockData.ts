export type ServiceKey = "epc" | "asbestos" | "electrical" | "fuel";

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

export type Status = "draft" | "scheduled" | "in_progress" | "delivered" | "completed";

export const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "#f1f5f9", fg: "#475569" },
  scheduled: { label: "Scheduled", bg: "#dbeafe", fg: "#1d4ed8" },
  in_progress: { label: "In progress", bg: "#fef3c7", fg: "#b45309" },
  delivered: { label: "Delivered", bg: "#dcfce7", fg: "#15803d" },
  completed: { label: "Completed", bg: "#ecfccb", fg: "#365314" },
};

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

export const USERS = [
  { id: "u_1", name: "Jordan Remy", email: "jordan@asbestexperts.be", role: "admin", team: "—", avatar: "JR", online: true },
  { id: "u_2", name: "Els Vermeulen", email: "els@vastgoedantwerp.be", role: "realtor", team: "Vastgoed Antwerp", avatar: "EV", online: true },
  { id: "u_3", name: "Tim De Vos", email: "tim@immo.be", role: "freelancer", team: "—", avatar: "TV", online: false },
  { id: "u_4", name: "Sofie Janssens", email: "sofie@immo.be", role: "freelancer", team: "—", avatar: "SJ", online: true },
  { id: "u_5", name: "Dieter Claes", email: "dieter@immo.be", role: "freelancer", team: "—", avatar: "DC", online: false },
  { id: "u_6", name: "Pierre Dubois", email: "pierre@immobruxelles.be", role: "realtor", team: "Immo Bruxelles", avatar: "PD", online: true },
  { id: "u_7", name: "Nele Willems", email: "nele@immo.be", role: "freelancer", team: "—", avatar: "NW", online: false },
  { id: "u_8", name: "Marie Lefevre", email: "marie@immo.be", role: "staff", team: "—", avatar: "ML", online: true },
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
