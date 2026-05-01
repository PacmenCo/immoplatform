"use client";

import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Input";
import { useAppearance } from "@/components/theme/useAppearance";

export function AppearanceClient() {
  const tDensity = useTranslations("dashboard.settings.appearance.density");
  const tMotion = useTranslations("dashboard.settings.appearance.motion");
  const tApp = useTranslations("dashboard.settings.appearance");
  const { prefs, update } = useAppearance();

  const densityLabel = (d: "comfortable" | "compact") =>
    d === "comfortable" ? tDensity("comfortable") : tDensity("compact");
  const densityHint = (d: "comfortable" | "compact") =>
    d === "comfortable" ? tDensity("comfortableHint") : tDensity("compactHint");

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{tDensity("title")}</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            {tDensity("subtitle")}
          </p>
        </CardHeader>
        <CardBody>
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label={tDensity("ariaLabel")}
          >
            {(["comfortable", "compact"] as const).map((d) => {
              const active = prefs.density === d;
              return (
                <label
                  key={d}
                  className={
                    "flex cursor-pointer items-start gap-3 rounded-md border bg-[var(--color-bg)] p-4 transition-colors " +
                    (active
                      ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/15"
                      : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]")
                  }
                >
                  <input
                    type="radio"
                    name="density"
                    value={d}
                    checked={active}
                    onChange={() => update({ density: d })}
                    className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-ink)]">
                      {densityLabel(d)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                      {densityHint(d)}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tMotion("title")}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <div>
              <p className="font-medium text-[var(--color-ink)]">{tMotion("reduceMotion")}</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                {tMotion("reduceMotionHint")}
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.reduceMotion}
              onChange={(e) => update({ reduceMotion: e.currentTarget.checked })}
              className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
            />
          </label>

          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <div>
              <p className="font-medium text-[var(--color-ink)]">{tMotion("highContrast")}</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                {tMotion("highContrastHint")}
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.highContrast}
              onChange={(e) => update({ highContrast: e.currentTarget.checked })}
              className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
            />
          </label>

          <Field
            label={tMotion("language")}
            id="lang"
            hint={tMotion("languageHint")}
          >
            <Select
              id="lang"
              value={prefs.language}
              onChange={(e) => update({ language: e.currentTarget.value as "en" | "nl" | "fr" })}
            >
              <option value="en">{tMotion("english")}</option>
              <option value="nl">{tMotion("dutch")}</option>
              <option value="fr">{tMotion("french")}</option>
            </Select>
          </Field>
        </CardBody>
      </Card>

      <p className="pt-2 text-xs text-[var(--color-ink-muted)]">
        {tApp("footer")}
      </p>
    </div>
  );
}
