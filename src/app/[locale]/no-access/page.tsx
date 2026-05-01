import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconShield, IconArrowRight } from "@/components/ui/Icons";
import { BRAND_NAME } from "@/lib/site";

const SECTION_KEYS = [
  "users",
  "invite",
  "teams",
  "newAssignment",
  "commissions",
  "revenue",
  "announcements",
  "admin",
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

// Map URL `?section=…` slugs (kebab-case kept for back-compat with existing
// links) onto the camelCase translation keys under `auth.noAccess.sections.*`.
const SECTION_SLUG_TO_KEY: Record<string, SectionKey> = {
  users: "users",
  invite: "invite",
  teams: "teams",
  "new-assignment": "newAssignment",
  commissions: "commissions",
  revenue: "revenue",
  announcements: "announcements",
  admin: "admin",
};

export type NoAccessSection = keyof typeof SECTION_SLUG_TO_KEY;

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const t = await getTranslations("auth.noAccess");
  const sectionKey = section ? SECTION_SLUG_TO_KEY[section] : undefined;
  const title = sectionKey
    ? t(`sections.${sectionKey}.title`, { brand: BRAND_NAME })
    : t("default.title");
  const body = sectionKey
    ? t(`sections.${sectionKey}.body`, { brand: BRAND_NAME })
    : t("default.body");

  return (
    <>
      <Topbar title={t("topbarTitle")} subtitle={t("topbarSubtitle")} />
      <div className="p-8 max-w-[720px]">
        <Card>
          <CardBody className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[color-mix(in_srgb,var(--color-asbestos)_10%,var(--color-bg))] text-[var(--color-asbestos)]">
              <IconShield size={20} />
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[var(--color-ink)]">
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                {body}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button href="/dashboard" size="sm">
                  {t("returnToDashboard")}
                  <IconArrowRight size={12} />
                </Button>
                <Link
                  href="mailto:support@immo.app"
                  className="text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:underline"
                >
                  {t("contactSupport")}
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
