import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { IconMail } from "@/components/ui/Icons";
import { confirmEmailVerification } from "@/app/actions/profile";

type SearchParams = Promise<{ token?: string }>;

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token } = await searchParams;
  const t = await getTranslations("auth.verifyEmail");
  const tCommon = await getTranslations("auth.common");

  // Two modes:
  //   ?token=…  → consume the token and show confirm/error
  //   no token  → "check your inbox" landing (post-registration flow)
  if (token) {
    const result = await confirmEmailVerification(token);
    if (result.ok) {
      return (
        <AuthShell
          title={t("verifiedHeading")}
          subtitle={t("verifiedSubtitle", {
            email: result.data?.email ?? tCommon("unknownEmail"),
          })}
          footer={
            <>
              {t("verifiedFooterPrompt")}{" "}
              <Link href="/dashboard/settings" className="font-medium text-[var(--color-ink)] hover:underline">
                {t("verifiedFooterCta")}
              </Link>
            </>
          }
        >
          <div className="space-y-6">
            <div className="flex items-start gap-4 rounded-[var(--radius-md)] border border-[var(--color-epc)]/30 bg-[color-mix(in_srgb,var(--color-epc)_8%,var(--color-bg))] p-5">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[var(--color-epc)] text-white">
                <IconMail size={18} />
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">{t("verifiedCardTitle")}</p>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                  {t("verifiedCardBody")}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <Button href="/dashboard" size="lg" className="w-full">
                {t("goToDashboard")}
              </Button>
              <Button href="/dashboard/settings" variant="secondary" size="lg" className="w-full">
                {t("backToSettings")}
              </Button>
            </div>
          </div>
        </AuthShell>
      );
    }
    return (
      <AuthShell
        title={t("errorHeading")}
        subtitle={result.error}
        footer={
          <>
            {t("errorFooterPrompt")}{" "}
            <a href="mailto:Jordan@asbestexperts.be" className="font-medium text-[var(--color-ink)] hover:underline">
              {t("errorFooterCta")}
            </a>
          </>
        }
      >
        <div className="space-y-6">
          <p className="text-sm text-[var(--color-ink-soft)]">
            {t("errorBody")}
          </p>
          <div className="space-y-3">
            <Button href="/dashboard/settings" size="lg" className="w-full">
              {t("errorRequestNewLink")}
            </Button>
            <Button href="/login" variant="secondary" size="lg" className="w-full">
              {t("errorBackToLogin")}
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  // No token → post-registration "check your inbox" landing.
  return (
    <AuthShell
      title={t("checkInboxHeading")}
      subtitle={t("checkInboxSubtitle")}
      footer={
        <>
          {t("checkInboxFooterPrompt")}{" "}
          <Link href="/register" className="font-medium text-[var(--color-ink)] hover:underline">
            {t("checkInboxFooterCta")}
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-start gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-white text-[var(--color-ink)]">
            <IconMail size={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">{t("checkInboxCardTitle")}</p>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {t("checkInboxCardBody")}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button href="/login" size="lg" className="w-full">
            {t("checkInboxBackToLogin")}
          </Button>
        </div>

        <p className="text-xs text-[var(--color-ink-muted)]">
          {t("checkInboxFallbackPrefix")}{" "}
          <a href="mailto:Jordan@asbestexperts.be" className="font-medium text-[var(--color-ink)] hover:underline">
            Jordan@asbestexperts.be
          </a>{" "}
          {t("checkInboxFallbackSuffix")}
        </p>
      </div>
    </AuthShell>
  );
}
