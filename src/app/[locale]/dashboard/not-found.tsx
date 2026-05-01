import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { IconSearch } from "@/components/ui/Icons";

// Dashboard-scoped 404. Next.js wraps this in `src/app/dashboard/layout.tsx`,
// so the sidebar + signed-in chrome stay visible — without this file, hits to
// unknown /dashboard/* routes would fall back to `src/app/not-found.tsx`
// (the marketing shell), making authenticated users feel signed-out.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.pageTitles");
  return { title: t("notFound") };
}

export default async function DashboardNotFound() {
  const t = await getTranslations("dashboard.notFoundPage");
  return (
    <>
      <Topbar
        title={t("topbarTitle")}
        subtitle={t("topbarSubtitle")}
      />
      <div className="p-8 max-w-[1100px]">
        <Card>
          <CardBody>
            <EmptyState
              icon={<IconSearch size={22} />}
              title={t("title")}
              description={t("description")}
              action={<Button href="/dashboard">{t("backToDashboard")}</Button>}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
