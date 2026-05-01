import { getTranslations } from "next-intl/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { SettingsNav } from "../_nav";
import { AppearanceClient } from "./AppearanceClient";
import { SettingsScopeBanner } from "@/components/dashboard/SettingsScopeBanner";

export default async function AppearanceSettingsPage() {
  const tTopbar = await getTranslations("dashboard.settings.appearance.topbar");
  const tScope = await getTranslations("dashboard.settings.scope");
  return (
    <>
      <Topbar title={tTopbar("title")} subtitle={tTopbar("subtitle")} />

      <div className="p-8 max-w-[1000px]">
        <SettingsNav />
        <div className="mt-6">
          <SettingsScopeBanner
            scope="personal"
            description={tScope("appearanceDescription")}
          />
        </div>
        <AppearanceClient />
      </div>
    </>
  );
}
