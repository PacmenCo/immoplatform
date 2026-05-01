import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { IconAlert } from "@/components/ui/Icons";
import { requireSession } from "@/lib/auth";
import { avatarImageUrl } from "@/lib/avatar";
import { initials, fullName } from "@/lib/format";
import { SettingsNav } from "./_nav";
import { ProfileForm, type ProfileFormInitial } from "./ProfileForm";
import { DeleteAccountButton } from "./DeleteAccountButton";
import { SettingsScopeBanner } from "@/components/dashboard/SettingsScopeBanner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.pageTitles");
  return { title: t("settings") };
}

export default async function SettingsPage() {
  const session = await requireSession();
  const u = session.user;
  const initial: ProfileFormInitial = {
    email: u.email,
    emailVerified: !!u.emailVerifiedAt,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    region: u.region,
    bio: u.bio,
    avatarInitials: initials(u.firstName, u.lastName),
    avatarAlt: fullName(u),
    avatarUrl: avatarImageUrl(u),
  };

  const tTopbar = await getTranslations("dashboard.settings.topbar");
  const tDanger = await getTranslations("dashboard.settings.profile.danger");

  return (
    <>
      <Topbar title={tTopbar("title")} subtitle={tTopbar("subtitle")} />

      <div className="p-8 max-w-[1000px]">
        <SettingsNav />

        <div className="mt-6 space-y-6">
          <SettingsScopeBanner scope="personal" />

          <ProfileForm initial={initial} />

          <Card className="border-[var(--color-asbestos)]/40">
            <CardHeader className="border-[var(--color-asbestos)]/40">
              <div className="flex items-center gap-2">
                <IconAlert
                  size={16}
                  className="text-[var(--color-asbestos)]"
                />
                <CardTitle className="text-[var(--color-asbestos)]">
                  {tDanger("title")}
                </CardTitle>
              </div>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                {tDanger("subtitle")}
              </p>
            </CardHeader>
            <CardBody className="divide-y divide-[var(--color-border)] p-0">
              <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{tDanger("deleteHeading")}</p>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                    {tDanger("deleteBody")}
                  </p>
                </div>
                <DeleteAccountButton />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
