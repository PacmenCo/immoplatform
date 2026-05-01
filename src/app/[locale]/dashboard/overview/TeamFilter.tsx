"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/Input";

type Team = { id: string; name: string };

type Props = {
  /** Currently selected team id, or "" for "all teams". */
  value: string;
  teams: Team[];
};

/**
 * Drops `team` onto the URL and lets the server re-fetch the filtered
 * snapshot. Preserves every other URL param so the period + sort stay put.
 * Mirrors Platform OverviewList.php's selectedTeamId.
 */
export function TeamFilter({ value, teams }: Props) {
  const t = useTranslations("dashboard.overview.filters");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  function push(nextValue: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (nextValue) sp.set("team", nextValue);
    else sp.delete("team");
    const qs = sp.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div className="w-[200px] shrink-0">
      <Select
        value={value}
        onChange={(e) => push(e.target.value)}
        aria-label={t("filterByTeam")}
        aria-busy={pending}
      >
        <option value="">{t("allTeams")}</option>
        {teams.map((tm) => (
          <option key={tm.id} value={tm.id}>
            {tm.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
