"use client";

import { useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";
export type EffectiveTheme = "light" | "dark";

const STORAGE_KEY = "theme-pref";

function readPref(): ThemePref {
  if (typeof window === "undefined") return "system";
  const root = document.documentElement.getAttribute("data-theme-pref");
  if (root === "light" || root === "dark") return root;
  return "system";
}

function systemTheme(): EffectiveTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(pref: ThemePref) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const effective: EffectiveTheme = pref === "system" ? systemTheme() : pref;
  root.setAttribute("data-theme", effective);
  root.setAttribute("data-theme-pref", pref);
}

export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [effective, setEffective] = useState<EffectiveTheme>("light");

  useEffect(() => {
    setPrefState(readPref());
    setEffective(
      (document.documentElement.getAttribute("data-theme") as EffectiveTheme) ?? "light",
    );

    // Listen to OS changes when user is in "system" mode
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = readPref();
      if (current === "system") {
        applyTheme("system");
        setEffective(systemTheme());
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function setPref(next: ThemePref) {
    setPrefState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    applyTheme(next);
    setEffective(next === "system" ? systemTheme() : next);
  }

  return { pref, effective, setPref };
}
