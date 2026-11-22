"use client";
/* Re-themes the dashboard with the analysed website's colours.
 * Tailwind v4 exposes every colour as a CSS variable (e.g. --color-indigo-500), so overriding the
 * indigo/violet scales re-colours every button, badge, chart and nav item at once. */
import { contrast, luminance, type Summary } from "./report";

type HSL = [number, number, number];
const hexToHsl = (hex: string): HSL => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l * 100];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
};
const hsl = (h: number, s: number, l: number) => `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
const sat = (hex: string) => hexToHsl(hex)[1];

/** Lightness steps similar to Tailwind's scales. 500/600 stay dark enough for white text. */
const STEPS: [string, number][] = [["50", 97], ["100", 94], ["200", 87], ["300", 77], ["400", 64], ["500", 52], ["600", 44], ["700", 37], ["800", 29], ["900", 22], ["950", 14]];
function scale(hex: string) {
  const [h, s] = hexToHsl(hex);
  const S = Math.max(s, 45); // keep it colourful enough to read as an accent
  return Object.fromEntries(STEPS.map(([k, l]) => [k, hsl(h, S, l)]));
}

export type SiteTheme = { vars: Record<string, string>; dark: boolean; accent: string; accent2: string; bg: string };

export function buildSiteTheme(s: Summary): SiteTheme | null {
  const bg = s.palette.primaryBg;
  const candidates = [
    ...(s.design?.buttons || []).map((b) => b.bg).filter(Boolean) as string[],
    ...s.palette.accents,
    ...s.palette.text.map((t) => t.value),
  ].filter((c) => /^#[0-9a-f]{6}$/i.test(c) && sat(c) > 25 && luminance(c) > 0.02 && luminance(c) < 0.85);
  const accent = candidates[0];
  if (!accent) return null;
  const accent2 = candidates.find((c) => Math.abs(hexToHsl(c)[0] - hexToHsl(accent)[0]) > 25) || accent;
  const dark = luminance(bg) < 0.25;
  const a = scale(accent), b = scale(accent2);
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(a)) vars[`--color-indigo-${k}`] = v;
  for (const [k, v] of Object.entries(b)) vars[`--color-violet-${k}`] = v;
  // App background: the site's own background, softened so cards and text stay readable
  const [bh, bs, bl] = hexToHsl(bg);
  // a tint of the site's background for each mode, so the user's own light/dark choice always applies
  vars["--app-bg-light"] = hsl(bh, Math.min(bs, 50), Math.max(bl, 96));
  vars["--app-bg-dark"] = hsl(bh, Math.min(bs, 40), Math.min(bl, 9));
  vars["--app-glow-1"] = a["500"];
  vars["--app-glow-2"] = b["500"];
  return { vars, dark, accent, accent2, bg };
}

const KEYS = [...STEPS.flatMap(([k]) => [`--color-indigo-${k}`, `--color-violet-${k}`]), "--app-bg-light", "--app-bg-dark", "--app-glow-1", "--app-glow-2"];

/** Applies (or clears, when theme is null) the site theme on <html>. */
export function applySiteTheme(theme: SiteTheme | null) {
  const st = document.documentElement.style;
  KEYS.forEach((k) => st.removeProperty(k));
  if (!theme) return;
  for (const [k, v] of Object.entries(theme.vars)) st.setProperty(k, v);
}

/** True if white text is readable on this colour. */
export const whiteOk = (hex: string) => contrast(hex, "#ffffff") >= 3;
