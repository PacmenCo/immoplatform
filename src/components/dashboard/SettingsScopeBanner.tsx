import { getTranslations } from "next-intl/server";
import { IconShield, IconBuilding } from "@/components/ui/Icons";

/**
 * Banner shown at the top of a settings subpage to make it obvious who a
 * setting affects. Two flavours:
 *
 * - `personal` — changes only apply to the signed-in user's account.
 * - `org` — changes apply to the whole workspace / every member.
 *
 * The Platform (Laravel) app has a one-sentence hint inline in email
 * preferences but no consistent indicator; this is Immo-specific UX to prevent
 * users from editing org-level fields thinking they're personal and vice versa.
 */
type Scope = "personal" | "org";

type Props = {
  scope: Scope;
  /** Optional override — otherwise uses the default copy per scope. */
  title?: string;
  /** Optional override — otherwise uses the default copy per scope. */
  description?: string;
};

export async function SettingsScopeBanner({ scope, title, description }: Props) {
  const t = await getTranslations("dashboard.shared.settingsScopeBanner");
  const defaultTitle = scope === "personal" ? t("personalTitle") : t("orgTitle");
  const defaultDescription =
    scope === "personal" ? t("personalDescription") : t("orgDescription");
  const Icon = scope === "personal" ? IconShield : IconBuilding;
  // Personal → neutral/slate. Org → amber accent so it feels weightier.
  const accent = scope === "personal" ? "var(--color-ink-muted)" : "var(--color-electrical)";

  return (
    <div
      role="note"
      aria-label={t("ariaLabel", { title: title ?? defaultTitle })}
      className="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm"
    >
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-bg)]"
        style={{ color: accent }}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--color-ink)]">{title ?? defaultTitle}</p>
        <p className="mt-0.5 text-[var(--color-ink-soft)]">
          {description ?? defaultDescription}
        </p>
      </div>
    </div>
  );
}
