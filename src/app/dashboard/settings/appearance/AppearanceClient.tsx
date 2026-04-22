"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Input";
import { useTheme, type ThemePref } from "@/components/theme/useTheme";
import { useAppearance } from "@/components/theme/useAppearance";

const themes: Array<{ key: ThemePref; label: string; description: string }> = [
  { key: "light",  label: "Light",  description: "Clean white surfaces, best for daytime." },
  { key: "dark",   label: "Dark",   description: "Low-light palette — easier on the eyes at night." },
  { key: "system", label: "System", description: "Follows your OS appearance setting." },
];

export function AppearanceClient() {
  const { pref, setPref } = useTheme();
  const { prefs, update } = useAppearance();

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Choose the overall appearance of the dashboard. Changes apply immediately.
          </p>
        </CardHeader>
        <CardBody>
          <div
            className="grid gap-4 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Theme"
          >
            {themes.map((t) => (
              <label
                key={t.key}
                className={
                  "group relative flex cursor-pointer flex-col gap-3 rounded-[var(--radius-md)] border bg-[var(--color-bg)] p-4 transition-all " +
                  (pref === t.key
                    ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/15"
                    : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]")
                }
              >
                <input
                  type="radio"
                  name="theme"
                  value={t.key}
                  checked={pref === t.key}
                  onChange={() => setPref(t.key)}
                  className="sr-only"
                />
                <ThemePreview variant={t.key} />
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--color-ink)]">
                      {t.label}
                    </span>
                    {pref === t.key && (
                      <span className="rounded-full bg-[var(--color-brand)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-on-brand)]">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                    {t.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </CardBody>
      </Card>

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

function ThemePreview({ variant }: { variant: ThemePref }) {
  if (variant === "dark") {
    return (
      <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[#0b1120]">
        <div className="flex gap-2 border-b border-white/10 p-2">
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
        </div>
        <div className="space-y-1.5 p-3">
          <div className="h-2 w-2/3 rounded bg-white/25" />
          <div className="h-2 w-1/2 rounded bg-white/15" />
          <div className="h-2 w-full rounded bg-white/10" />
        </div>
      </div>
    );
  }
  if (variant === "system") {
    return (
      <div className="overflow-hidden rounded-md border border-[var(--color-border)]">
        <div className="flex">
          <div className="w-1/2 bg-white p-2">
            <div className="h-2 w-2/3 rounded bg-[#0f172a] opacity-20" />
            <div className="mt-1.5 h-2 w-1/2 rounded bg-[#0f172a] opacity-10" />
          </div>
          <div className="w-1/2 bg-[#0b1120] p-2">
            <div className="h-2 w-2/3 rounded bg-white/25" />
            <div className="mt-1.5 h-2 w-1/2 rounded bg-white/15" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-white">
      <div className="flex gap-2 border-b border-[var(--color-border)] p-2">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
      </div>
      <div className="space-y-1.5 p-3">
        <div className="h-2 w-2/3 rounded bg-[#0f172a] opacity-70" />
        <div className="h-2 w-1/2 rounded bg-[#0f172a] opacity-40" />
        <div className="h-2 w-full rounded bg-[#0f172a] opacity-20" />
      </div>
    </div>
  );
}
