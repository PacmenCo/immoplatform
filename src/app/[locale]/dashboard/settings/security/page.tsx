import { getTranslations } from "next-intl/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { formatUserAgent } from "@/lib/userAgent";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { RevokeSessionButton, SignOutAllButton } from "./SessionRowActions";
import { SettingsNav } from "../_nav";
import { SettingsScopeBanner } from "@/components/dashboard/SettingsScopeBanner";

// Use a structural type for the relativeTime translator: the keys it
// needs are a known fixed set, so this avoids the deep Translator
// instantiation that triggers TS2589 when next-intl's full namespace
// path is inferred.
type RelativeTimeTranslator = (
  key:
    | "activeNow"
    | "minutesAgo"
    | "hoursAgo"
    | "daysAgo"
    | "monthsAgo"
    | "yearsAgo",
  values?: { count: number },
) => string;

function relativeTime(from: Date, now: Date, t: RelativeTimeTranslator): string {
  const diffMs = now.getTime() - from.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return t("activeNow");
  const min = Math.floor(sec / 60);
  if (min < 60) return t("minutesAgo", { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("hoursAgo", { count: hr });
  const day = Math.floor(hr / 24);
  if (day < 30) return t("daysAgo", { count: day });
  const mon = Math.floor(day / 30);
  if (mon < 12) return t("monthsAgo", { count: mon });
  return t("yearsAgo", { count: Math.floor(mon / 12) });
}

export default async function SecuritySettingsPage() {
  const session = await requireSession();
  const tTopbar = await getTranslations("dashboard.settings.security.topbar");
  const tPwd = await getTranslations("dashboard.settings.security.password");
  const tSes = await getTranslations("dashboard.settings.security.sessions");
  const tAll = await getTranslations("dashboard.settings.security.signOutAll");

  const sessions = await prisma.session.findMany({
    where: {
      userId: session.user.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      userAgent: true,
      ip: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  const now = new Date();
  const otherCount = sessions.filter((s) => s.id !== session.id).length;

  return (
    <>
      <Topbar title={tTopbar("title")} subtitle={tTopbar("subtitle")} />

      <div className="p-8 max-w-[960px]">
        <SettingsNav />
        <div className="mt-6 space-y-8">
          <SettingsScopeBanner scope="personal" />
          <Card>
          <CardHeader>
            <CardTitle>{tPwd("title")}</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {tPwd("subtitle")}
            </p>
          </CardHeader>
          <CardBody>
            <PasswordChangeForm />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tSes("title")}</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {tSes("subtitle")}
            </p>
          </CardHeader>
          <CardBody className="p-0">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
                {tSes("empty")}
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {sessions.map((s) => {
                  const ua = formatUserAgent(s.userAgent);
                  const isCurrent = s.id === session.id;
                  return (
                    <li
                      key={s.id}
                      className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-[var(--color-ink)]">
                            {ua.label}
                          </p>
                          {isCurrent && (
                            <Badge
                              bg="color-mix(in srgb, var(--color-epc) 14%, var(--color-bg))"
                              fg="var(--color-epc)"
                            >
                              {tSes("thisDevice")}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                          {s.ip ?? tSes("ipUnknown")} · {relativeTime(s.lastSeenAt, now, tSes)}
                        </p>
                      </div>
                      {isCurrent ? (
                        <span className="text-xs text-[var(--color-ink-muted)]">—</span>
                      ) : (
                        <RevokeSessionButton sessionId={s.id} device={ua.label} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[var(--color-asbestos)]">{tAll("title")}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="text-sm text-[var(--color-ink-soft)]">
              {tAll("body")}
              {otherCount > 0 && (
                <>
                  {tAll.rich("otherSessions", {
                    count: otherCount,
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </>
              )}
            </p>
            <SignOutAllButton hasOthers={otherCount > 0} />
          </CardBody>
        </Card>
        </div>
      </div>
    </>
  );
}
