import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody } from "@/components/ui/Card";
import {
  IconList,
  IconUsers,
  IconBuilding,
  IconMegaphone,
  IconChart,
  IconArrowRight,
  IconWallet,
  IconPlug,
} from "@/components/ui/Icons";

const CARDS = [
  {
    href: "/dashboard/admin/price-list",
    icon: IconList,
    catalogKey: "priceList",
    accent: "var(--color-epc)",
  },
  {
    href: "/dashboard/users",
    icon: IconUsers,
    catalogKey: "users",
    accent: "var(--color-fuel)",
  },
  {
    href: "/dashboard/teams",
    icon: IconBuilding,
    catalogKey: "teams",
    accent: "var(--color-brand)",
  },
  {
    href: "/dashboard/announcements",
    icon: IconMegaphone,
    catalogKey: "announcements",
    accent: "var(--color-electrical)",
  },
  {
    href: "/dashboard/activity",
    icon: IconChart,
    catalogKey: "activity",
    accent: "var(--color-asbestos)",
  },
  {
    href: "/dashboard/commissions",
    icon: IconWallet,
    catalogKey: "commissions",
    accent: "#15803d",
  },
  {
    href: "/dashboard/settings/integrations",
    icon: IconPlug,
    catalogKey: "integrations",
    accent: "#6d28d9",
  },
] as const;

export default async function AdminHubPage() {
  const tTop = await getTranslations("dashboard.admin.home.topbar");
  const tHome = await getTranslations("dashboard.admin.home");
  const tCards = await getTranslations("dashboard.admin.home.cards");
  return (
    <>
      <Topbar title={tTop("title")} subtitle={tTop("subtitle")} />

      <div className="p-8 max-w-[1400px]">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{tHome("heading")}</h2>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{tHome("intro")}</p>
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
                  <h3 className="mt-4 font-semibold text-[var(--color-ink)] group-hover:underline">
                    {tCards(`${c.catalogKey}.title` as Parameters<typeof tCards>[0])}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                    {tCards(`${c.catalogKey}.description` as Parameters<typeof tCards>[0])}
                  </p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
