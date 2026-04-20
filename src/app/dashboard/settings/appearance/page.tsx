import { Topbar } from "@/components/dashboard/Topbar";
import { SettingsNav } from "../_nav";
import { AppearanceClient } from "./AppearanceClient";

export default function AppearanceSettingsPage() {
  return (
    <>
      <Topbar title="Appearance" subtitle="Theme, density, motion, language" />

      <div className="p-8 max-w-[1000px]">
        <SettingsNav />
        <AppearanceClient />
      </div>
    </>
  );
}
