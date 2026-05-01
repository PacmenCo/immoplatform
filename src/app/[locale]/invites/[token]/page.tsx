import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { IconBuilding, IconMapPin, IconShield, IconCheck } from "@/components/ui/Icons";
import { getInviteByToken } from "@/app/actions/invites";
import { getSession } from "@/lib/auth";
import { AlreadySignedIn } from "./AlreadySignedIn";
import { BrandName } from "@/components/BrandName";
import { BRAND_NAME } from "@/lib/site";

const roleColor: Record<string, { bg: string; fg: string }> = {
  admin: { bg: "#fef2f2", fg: "#b91c1c" },
  staff: { bg: "#f5f3ff", fg: "#6d28d9" },
  realtor: { bg: "#eff6ff", fg: "#1d4ed8" },
  freelancer: { bg: "#ecfdf5", fg: "#047857" },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [result, session] = await Promise.all([getInviteByToken(token), getSession()]);

  if (result.status !== "ok") {
    return <InviteProblem status={result.status} />;
  }

  const invite = result.invite;

  if (session) {
    return (
      <AlreadySignedIn
        currentEmail={session.user.email}
        inviteEmail={invite.email}
        continueHref={`/invites/${token}`}
      />
    );
  }
  const t = await getTranslations("auth.invite");
  const rc = roleColor[invite.role] ?? roleColor.realtor;
  const knownRoles = ["admin", "staff", "realtor", "freelancer"] as const;
  type KnownRole = (typeof knownRoles)[number];
  const roleKey: KnownRole = (knownRoles as readonly string[]).includes(invite.role)
    ? (invite.role as KnownRole)
    : "realtor";
  const roleLabel = t(`roles.${roleKey}`);
  const daysLeft = Math.max(
    1,
    Math.ceil((invite.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
  const inviterInitials =
    invite.invitedBy.firstName[0] + invite.invitedBy.lastName[0];
  const inviterName = `${invite.invitedBy.firstName} ${invite.invitedBy.lastName}`;

  return (
    <AuthShell
      title={t("heading")}
      subtitle={t("subtitle", { brand: BRAND_NAME })}
      footer={<>{t("expiresInDays", { days: daysLeft })}</>}
    >
      <div className="space-y-6">
        {/* Inviter */}
        <div className="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
          <Avatar initials={inviterInitials.toUpperCase()} size="md" color="#334155" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--color-ink-soft)]">
              {t.rich("invitedBy", {
                name: () => (
                  <span className="font-semibold text-[var(--color-ink)]">{inviterName}</span>
                ),
              })}
            </p>
            <p className="text-xs text-[var(--color-ink-muted)]">{invite.email}</p>
            {invite.note && (
              <p className="mt-3 rounded border-l-2 border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm italic text-[var(--color-ink-soft)]">
                &ldquo;{invite.note}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Access */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            {t("yourAccess")}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <IconShield size={16} className="shrink-0 text-[var(--color-ink-muted)]" />
            <span className="text-sm text-[var(--color-ink-soft)]">{t("role")}</span>
            <Badge bg={rc.bg} fg={rc.fg} size="md">{roleLabel}</Badge>
          </div>

          {invite.team && (
            <>
              <hr className="my-4 border-[var(--color-border)]" />
              <div className="flex items-start gap-3">
                <IconBuilding size={16} className="mt-0.5 shrink-0 text-[var(--color-ink-muted)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--color-ink-soft)]">{t("team")}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                      style={{ backgroundColor: invite.team.logoColor ?? "#0f172a" }}
                    >
                      {invite.team.logo ?? "??"}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--color-ink)]">{invite.team.name}</p>
                      <p className="flex items-center gap-1 text-xs text-[var(--color-ink-muted)]">
                        <IconMapPin size={12} />
                        {invite.team.city}
                      </p>
                    </div>
                  </div>
                  {invite.teamRole && (
                    <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
                      {t("joiningAs")}{" "}
                      <span
                        className={
                          "inline-flex items-center gap-1 font-semibold " +
                          (invite.teamRole === "owner"
                            ? "text-[var(--color-brand)]"
                            : "text-[var(--color-ink)]")
                        }
                      >
                        {invite.teamRole === "owner" && <IconShield size={12} />}
                        {invite.teamRole === "owner" ? t("teamOwner") : t("teamMember")}
                      </span>
                      {invite.teamRole === "owner" && t("teamOwnerSuffix")}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] p-4 text-xs text-[var(--color-ink-soft)]">
          <p className="font-medium text-[var(--color-ink)]">{t("whatsNext")}</p>
          <ul className="space-y-1.5">
            <Step n={1} label={t("step1")} active />
            <Step n={2} label={t("step2")} />
            <Step n={3} label={t("step3")} />
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Button href={`/invites/${token}/set-password`} size="lg" className="w-full">
            {t("accept")}
          </Button>
          <Button href="/" variant="secondary" size="lg" className="w-full">
            {t("decline")}
          </Button>
        </div>

        <p className="text-center text-xs text-[var(--color-ink-muted)]">
          {t.rich("termsAcceptance", {
            brand: () => <BrandName />,
          })}
        </p>
      </div>
    </AuthShell>
  );
}

function Step({ n, label, active = false }: { n: number; label: string; active?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={
          "grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold " +
          (active
            ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]"
            : "bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]")
        }
      >
        {active ? <IconCheck size={8} /> : n}
      </span>
      <span className={active ? "text-[var(--color-ink)]" : ""}>{label}</span>
    </li>
  );
}

async function InviteProblem({ status }: { status: "not_found" | "expired" | "revoked" | "accepted" }) {
  const t = await getTranslations("auth.invite.problems");
  const statusKey = (
    {
      not_found: "notFound",
      expired: "expired",
      revoked: "revoked",
      accepted: "accepted",
    } as const
  )[status];
  const ctaHref = (
    {
      not_found: "/contact",
      expired: "/contact",
      revoked: "/",
      accepted: "/login",
    } as const
  )[status];

  return (
    <AuthShell title={t(`${statusKey}.title`)} subtitle={t(`${statusKey}.body`)}>
      <div className="flex flex-col gap-3">
        <Button href={ctaHref} size="lg" className="w-full">
          {t(`${statusKey}.ctaLabel`)}
        </Button>
        <Button href="/" variant="secondary" size="lg" className="w-full">
          {t("returnHome")}
        </Button>
      </div>
      {status === "expired" && (
        <p className="mt-6 text-center text-xs text-[var(--color-ink-muted)]">
          {t("expiredFooterPrompt")}{" "}
          <Link href="/login" className="font-medium text-[var(--color-ink)] underline">
            {t("expiredFooterCta")}
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
