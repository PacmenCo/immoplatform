"use client";

import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Input";
import { SettingsNav } from "../_nav";
import { useTheme, type ThemePref } from "@/components/theme/useTheme";

const themes: Array<{ key: ThemePref; label: string; description: string }> = [
  {
    key: "light",
    label: "Light",
    description: "Clean white surfaces, best for daytime.",
  },
  {
    key: "dark",
    label: "Dark",
    description: "Low-light palette — easier on the eyes at night.",
  },
  {
    key: "system",
    label: "System",
    description: "Follows your OS appearance setting.",
  },
];

export default function AppearanceSettingsPage() {
  const { pref, setPref } = useTheme();

  return (
    <>
      <Topbar title="Appearance" subtitle="Theme, density, motion, language" />

      <div className="p-8 max-w-[1000px]">
        <SettingsNav />

        <div className="mt-6 space-y-6">
          {/* Theme */}
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

          {/* Density */}
          <Card>
            <CardHeader>
              <CardTitle>Density</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                How much content fits on one screen.
              </p>
            </CardHeader>
            <CardBody>
              <div
                className="grid gap-3 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Density"
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/15 bg-[var(--color-bg)] p-4">
                  <input
                    type="radio"
                    name="density"
                    value="comfortable"
                    defaultChecked
                    className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-ink)]">
                      Comfortable
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                      Default. Generous padding, easier to scan.
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-4 hover:border-[var(--color-border-strong)]">
                  <input
                    type="radio"
                    name="density"
                    value="compact"
                    className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-ink)]">
                      Compact
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                      Tighter rows and cards. Good for power users with lots of
                      assignments.
                    </p>
                  </div>
                </label>
              </div>
            </CardBody>
          </Card>

          {/* Motion + language */}
          <Card>
            <CardHeader>
              <CardTitle>Motion & language</CardTitle>
            </CardHeader>
            <CardBody className="space-y-5">
              <label className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">
                    Reduce motion
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                    Disable non-essential transitions. Respects your OS setting
                    automatically.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                />
              </label>

              <label className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">High contrast</p>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                    Stronger borders and text contrast for improved legibility.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                />
              </label>

              <Field
                label="Language"
                id="lang"
                hint="Re-loads the app in your chosen language."
              >
                <Select id="lang" defaultValue="en">
                  <option value="en">English</option>
                  <option value="nl">Nederlands</option>
                  <option value="fr">Français</option>
                </Select>
              </Field>
            </CardBody>
          </Card>
        </div>

        <div className="sticky bottom-0 -mx-8 mt-6 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 px-8 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[var(--color-ink-muted)]">
              Theme saves automatically. Other settings need Save.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="md">
                Cancel
              </Button>
              <Button size="md">Save changes</Button>
            </div>
          </div>
        </div>
      </div>
    </>
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
