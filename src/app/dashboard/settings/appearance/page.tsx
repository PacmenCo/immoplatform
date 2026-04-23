import { Topbar } from "@/components/dashboard/Topbar";
import { SettingsNav } from "../_nav";
import { AppearanceClient } from "./AppearanceClient";
import { SettingsScopeBanner } from "@/components/dashboard/SettingsScopeBanner";

export default function AppearanceSettingsPage() {
  return (
    <>
      <Topbar title="Appearance" subtitle="Theme, density, motion, language" />

      <div className="p-8 max-w-[1000px]">
        <SettingsNav />
        <div className="mt-6">
          <SettingsScopeBanner
            scope="personal"
            description="Theme, density and motion preferences are stored locally in this browser for your account only."
          />
        </div>
        <AppearanceClient />
      </div>
    </>
  );
}
