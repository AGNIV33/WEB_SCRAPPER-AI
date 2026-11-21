"use client";

import { useEffect, useState } from "react";

export type Settings = {
  theme: "light" | "dark" | "system";
  glass: boolean;          // glassmorphism UI
  siteBackground: boolean; // in glass mode, use the analysed site's screenshot + colours as background
  bgBlur: number;          // px, 0–40
  bgStrength: number;      // %, 10–100 (how visible the site background is)
  motion: boolean;         // GSAP animations
  defaultPages: number;    // default crawl limit
};

export const DEFAULTS: Settings = { theme: "light", glass: false, siteBackground: true, bgBlur: 18, bgStrength: 70, motion: true, defaultPages: 6 };
const KEY = "settings";

export function readSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    const legacy = localStorage.getItem("theme"); // older versions stored only the theme
    return { ...DEFAULTS, ...(legacy && !raw.theme ? { theme: legacy } : {}), ...raw };
  } catch {
    return DEFAULTS;
  }
}

/** Applies settings to <html>: .dark, .glass and .no-motion classes. */
export function applySettings(s: Settings) {
  const root = document.documentElement;
  const dark = s.theme === "dark" || (s.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.classList.toggle("glass", s.glass);
  root.classList.toggle("no-motion", !s.motion);
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => (typeof window === "undefined" ? DEFAULTS : readSettings()));
  useEffect(() => {
    applySettings(settings);
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
      localStorage.setItem("theme", settings.theme === "system" ? "" : settings.theme);
    } catch { /* ignore */ }
    if (settings.theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => applySettings(settings);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [settings]);
  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  return { settings, update, reset: () => setSettings(DEFAULTS) };
}
