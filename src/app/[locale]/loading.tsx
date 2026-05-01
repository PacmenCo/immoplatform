import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("common.loading");
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--color-bg-alt)]">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-brand)]"
        role="status"
        aria-label={t("aria")}
      />
    </div>
  );
}
