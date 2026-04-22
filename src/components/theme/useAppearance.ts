"use client";

/**
 * Appearance preferences beyond theme: density, reduced motion, high contrast,
 * language. Persisted to localStorage (matches Platform's Flux approach for
 * theme — client-side only, no server round-trip). Applied as data-* attrs on
 * <html> so CSS can hook them via [data-density="compact"] { ... } etc.
 *
 * Theme lives in a separate hook (useTheme) because it's pre-hydrated by
 * ThemeScript.tsx to avoid first-paint flash.
 */
import { useEffect, useState } from "react";

export type Density = "comfortable" | "compact";
export type Language = "en" | "nl" | "fr";

export type AppearancePrefs = {
  density: Density;
  reduceMotion: boolean;
  highContrast: boolean;
  language: Language;
};

const DEFAULTS: AppearancePrefs = {
  density: "comfortable",
  reduceMotion: false,
  highContrast: false,
  language: "en",
};

const STORAGE_KEY = "appearance-prefs";

function isDensity(x: string | null): x is Density {
  return x === "comfortable" || x === "compact";
}
function isLanguage(x: string | null): x is Language {
  return x === "en" || x === "nl" || x === "fr";
}

function readPrefs(): AppearancePrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>;
    return {
      density: isDensity(parsed.density ?? null) ? parsed.density! : DEFAULTS.density,
      reduceMotion: typeof parsed.reduceMotion === "boolean" ? parsed.reduceMotion : DEFAULTS.reduceMotion,
      highContrast: typeof parsed.highContrast === "boolean" ? parsed.highContrast : DEFAULTS.highContrast,
      language: isLanguage(parsed.language ?? null) ? parsed.language! : DEFAULTS.language,
    };
  } catch {
    return DEFAULTS;
  }
}

function apply(prefs: AppearancePrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-density", prefs.density);
  root.setAttribute("data-reduce-motion", prefs.reduceMotion ? "true" : "false");
  root.setAttribute("data-high-contrast", prefs.highContrast ? "true" : "false");
  root.setAttribute("data-language", prefs.language);
}

export function useAppearance() {
  const [prefs, setPrefs] = useState<AppearancePrefs>(DEFAULTS);

  useEffect(() => {
    const loaded = readPrefs();
    setPrefs(loaded);
    apply(loaded);
  }, []);

  function update(patch: Partial<AppearancePrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      apply(next);
      return next;
    });
  }

  return { prefs, update };
}
