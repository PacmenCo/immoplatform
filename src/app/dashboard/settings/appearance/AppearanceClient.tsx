"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Input";
import { useAppearance } from "@/components/theme/useAppearance";

export function AppearanceClient() {
  const { prefs, update } = useAppearance();

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Density</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            How much content fits on one screen. Saved automatically.
          </p>
        </CardHeader>
        <CardBody>
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Density"
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
                    <p className="text-sm font-semibold text-[var(--color-ink)] capitalize">
                      {d}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                      {d === "comfortable"
                        ? "Default. Generous padding, easier to scan."
                        : "Tighter rows and cards. Good for power users with lots of assignments."}
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
          <CardTitle>Motion & language</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <div>
              <p className="font-medium text-[var(--color-ink)]">Reduce motion</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                Disable non-essential transitions. Respects your OS setting too.
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
              <p className="font-medium text-[var(--color-ink)]">High contrast</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                Stronger borders and text contrast for improved legibility.
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
            label="Language"
            id="lang"
            hint="Dashboard copy only. Full i18n lands later."
          >
            <Select
              id="lang"
              value={prefs.language}
              onChange={(e) => update({ language: e.currentTarget.value as "en" | "nl" | "fr" })}
            >
              <option value="en">English</option>
              <option value="nl">Nederlands</option>
              <option value="fr">Français</option>
            </Select>
          </Field>
        </CardBody>
      </Card>

      <p className="pt-2 text-xs text-[var(--color-ink-muted)]">
        Every appearance setting saves automatically as you change it.
      </p>
    </div>
  );
}
