/* Turns the measured design into files developers can use directly:
 * design tokens (Figma Tokens Studio JSON, W3C DTCG JSON, Tailwind config, shadcn theme CSS, CSS variables)
 * and React + Tailwind components (Button, Card, Navbar, Input). */
import { contrast, luminance, type Summary } from "./report";

export type GenFile = { name: string; lang: "json" | "js" | "css" | "tsx"; code: string; note: string };

/** Picks the main roles from the measured palette (same logic as design.md). */
export function themeOf(s: Summary) {
  const d = s.design;
  const bg = s.palette.primaryBg, fg = s.palette.primaryText;
  const visibleAccents = s.palette.accents.filter((c) => contrast(bg, c) >= 3);
  const accent = visibleAccents[0] || s.palette.accents[0] || d?.buttons.find((b) => b.bg && b.bg !== bg)?.bg || fg;
  const accent2 = visibleAccents[1] || accent;
  const surface = s.palette.backgrounds.find((c) => c.value !== bg)?.value || bg;
  const muted = s.palette.text.find((c) => c.value !== fg && contrast(bg, c.value) < contrast(bg, fg) && contrast(bg, c.value) >= 2)?.value || fg;
  const border = s.palette.borders[0]?.value || surface;
  const onAccent = contrast(accent, "#ffffff") >= contrast(accent, "#000000") ? "#ffffff" : "#000000";
  const fonts = s.typography.families.map((f) => f.value);
  const sizes = [...s.typography.sizes].map((x) => x.value).sort((a, b) => parseFloat(a) - parseFloat(b));
  const radius = d?.radius.length ? [...d.radius].sort((a, b) => b.share - a.share)[0].value : "8px";
  return { bg, fg, accent, accent2, surface, muted, border, onAccent, fonts, sizes, radius, dark: luminance(bg) < 0.2, d };
}

const host = (s: Summary) => { try { return new URL(s.url || "").hostname; } catch { return "site"; } };
const sizeNames = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl"];

export function tokenFiles(s: Summary): GenFile[] {
  const t = themeOf(s);
  const d = t.d;
  const spacing = (d?.spacing || []).map((x) => x.value).sort((a, b) => parseFloat(a) - parseFloat(b));
  const radii = (d?.radius || []).map((x) => x.value).sort((a, b) => parseFloat(a) - parseFloat(b));
  const shadows = (d?.shadows || []).slice(0, 4).map((x) => x.value);
  const colors: Record<string, string> = { background: t.bg, foreground: t.fg, surface: t.surface, muted: t.muted, primary: t.accent, "primary-foreground": t.onAccent, secondary: t.accent2, border: t.border };
  const fontStack = (t.fonts.length ? t.fonts.slice(0, 2).map((f) => `"${f}"`).join(", ") + ", " : "") + "system-ui, sans-serif";

  // 1) Figma Tokens Studio (single-file format)
  const ts = {
    global: {
      color: Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, { value: v, type: "color" }])),
      fontFamilies: Object.fromEntries(t.fonts.slice(0, 3).map((f, i) => [i === 0 ? "primary" : i === 1 ? "secondary" : "tertiary", { value: f, type: "fontFamilies" }])),
      fontSizes: Object.fromEntries(t.sizes.map((v, i) => [sizeNames[i] || `size-${i}`, { value: v, type: "fontSizes" }])),
      fontWeights: Object.fromEntries(s.typography.weights.map((w) => [w.value, { value: w.value, type: "fontWeights" }])),
      spacing: Object.fromEntries(spacing.map((v, i) => [String(i + 1), { value: v, type: "spacing" }])),
      borderRadius: Object.fromEntries(radii.map((v, i) => [sizeNames[i] || `r-${i}`, { value: v, type: "borderRadius" }])),
      boxShadow: Object.fromEntries(shadows.map((v, i) => [`shadow-${i + 1}`, { value: v, type: "boxShadow" }])),
    },
  };
  // 2) W3C Design Tokens (DTCG) format
  const dtcg = {
    color: Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, { $type: "color", $value: v }])),
    font: { family: Object.fromEntries(t.fonts.slice(0, 3).map((f, i) => [i ? `alt${i}` : "primary", { $type: "fontFamily", $value: f }])), size: Object.fromEntries(t.sizes.map((v, i) => [sizeNames[i] || `s${i}`, { $type: "dimension", $value: v }])) },
    space: Object.fromEntries(spacing.map((v, i) => [String(i + 1), { $type: "dimension", $value: v }])),
    radius: Object.fromEntries(radii.map((v, i) => [sizeNames[i] || `r${i}`, { $type: "dimension", $value: v }])),
  };
  // 3) Tailwind config (v3 JS) – also usable from Tailwind v4 with @config
  const tw = `/** Tailwind theme extracted from ${host(s)} by Scrapper AI */
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: ${JSON.stringify(colors, null, 8).replace(/\n\s*}$/, "\n      }")},
      fontFamily: { sans: [${[...t.fonts.slice(0, 2).map((f) => JSON.stringify(f)), '"system-ui"', '"sans-serif"'].join(", ")}] },
      fontSize: { ${t.sizes.map((v, i) => `"${sizeNames[i] || `s${i}`}": "${v}"`).join(", ")} },
      borderRadius: { ${radii.slice(0, 6).map((v, i) => `"${sizeNames[i]}": "${v}"`).join(", ")} },
      spacing: { ${spacing.slice(0, 14).map((v, i) => `"s${i + 1}": "${v}"`).join(", ")} },
      boxShadow: { ${shadows.map((v, i) => `"s${i + 1}": ${JSON.stringify(v)}`).join(", ")} },
      maxWidth: { container: "${d?.maxWidths[0]?.value || "1200px"}" },
    },
  },
};
`;
  // 4) shadcn/ui theme (Tailwind v4 / shadcn v2+ style: plain colour values)
  const shadcn = `/* shadcn/ui theme for ${host(s)} — paste into app/globals.css (replace the :root block) */
:root {
  --radius: ${t.radius};
  --background: ${t.bg};
  --foreground: ${t.fg};
  --card: ${t.surface};
  --card-foreground: ${t.fg};
  --popover: ${t.bg};
  --popover-foreground: ${t.fg};
  --primary: ${t.accent};
  --primary-foreground: ${t.onAccent};
  --secondary: ${t.surface};
  --secondary-foreground: ${t.fg};
  --muted: ${t.surface};
  --muted-foreground: ${t.muted};
  --accent: ${t.accent2};
  --accent-foreground: ${contrast(t.accent2, "#ffffff") >= 3 ? "#ffffff" : "#000000"};
  --destructive: #dc2626;
  --border: ${t.border};
  --input: ${t.border};
  --ring: ${t.accent};
  --font-sans: ${fontStack};
}
`;
  // 5) Plain CSS variables
  const css = `/* Design tokens for ${host(s)} */
:root {
${Object.entries(colors).map(([k, v]) => `  --color-${k}: ${v};`).join("\n")}
  --font-sans: ${fontStack};
${t.sizes.map((v, i) => `  --text-${sizeNames[i] || i}: ${v};`).join("\n")}
${spacing.map((v, i) => `  --space-${i + 1}: ${v};`).join("\n")}
${radii.map((v, i) => `  --radius-${sizeNames[i] || i}: ${v};`).join("\n")}
${shadows.map((v, i) => `  --shadow-${i + 1}: ${v};`).join("\n")}
}
`;
  return [
    { name: "tokens.figma.json", lang: "json", code: JSON.stringify(ts, null, 2), note: "Figma: install the Tokens Studio plugin → Tools → Load from file." },
    { name: "tokens.dtcg.json", lang: "json", code: JSON.stringify(dtcg, null, 2), note: "W3C Design Tokens format (Style Dictionary, Penpot, Supernova…)." },
    { name: "tailwind.config.js", lang: "js", code: tw, note: "Tailwind v3 config. In Tailwind v4 add `@config \"./tailwind.config.js\";` to your CSS." },
    { name: "shadcn-theme.css", lang: "css", code: shadcn, note: "shadcn/ui: replace the :root block in your globals.css." },
    { name: "tokens.css", lang: "css", code: css, note: "Plain CSS custom properties for any project." },
  ];
}

/* ---------------- React + Tailwind components ---------------- */
const arb = (v?: string | null) => (v ? v.replace(/\s+/g, "_") : "");
function padClasses(p?: string) {
  const v = (p || "").split(/\s+/).filter(Boolean);
  if (!v.length || v.every((x) => x === "0px")) return "px-4 py-2";
  const [t, r = t, b = t, l = r] = v;
  return t === b && r === l ? `py-[${t}] px-[${r}]` : `pt-[${t}] pr-[${r}] pb-[${b}] pl-[${l}]`;
}

export function componentFiles(s: Summary): GenFile[] {
  const t = themeOf(s);
  const d = t.d;
  const btns = (d?.buttons || []).filter((b) => b.text).slice(0, 3);
  const variants = (btns.length ? btns : [{ text: "Button", bg: t.accent, bgImage: null, color: t.onAccent, border: "none", radius: t.radius, padding: "10px 20px", fontSize: "16px", fontWeight: "600", shadow: null, transition: null, height: "40px" }]).map((b, i) => {
    const bg = b.bgImage ? `bg-[${arb(b.bgImage)}]` : b.bg ? `bg-[${b.bg}]` : "bg-transparent";
    const border = b.border && b.border !== "none" ? `border-[${b.border.split(" ")[0]}] border-[${b.border.split(" ").pop()}]` : "border-0";
    const cls = [bg, `text-[${b.color || t.fg}]`, border, `rounded-[${b.radius}]`, padClasses(b.padding), `text-[${b.fontSize}]`, `font-[${b.fontWeight}]`, b.shadow ? `shadow-[${arb(b.shadow)}]` : ""].filter(Boolean).join(" ");
    return { name: i === 0 ? "primary" : i === 1 ? "secondary" : "ghost", cls, label: b.text };
  });
  const card = d?.cards[0];
  const header = d?.header;
  const input = d?.input;
  const fontCls = t.fonts[0] ? `font-[${arb(`"${t.fonts[0]}"`)}]` : "";

  const button = `// Button.tsx — generated from ${host(s)} by Scrapper AI (React + Tailwind)
import type { ButtonHTMLAttributes } from "react";

const variants = {
${variants.map((v) => `  ${v.name}: "${v.cls}", // seen as "${v.label.replace(/"/g, "'")}"`).join("\n")}
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants };

export function Button({ variant = "primary", className = "", ...props }: Props) {
  return (
    <button
      className={\`inline-flex items-center justify-center gap-2 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[${t.accent}] disabled:pointer-events-none disabled:opacity-50 \${variants[variant]} \${className}\`}
      {...props}
    />
  );
}
`;
  const cardCode = `// Card.tsx — generated from ${host(s)} by Scrapper AI
import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={\`bg-[${card?.bg || t.surface}] rounded-[${card?.radius || t.radius}] ${card?.padding && card.padding !== "0px" ? padClasses(card.padding) : "p-6"} ${card?.border ? `border-[${card.border.split(" ")[0]}] border-[${card.border.split(" ").pop()}]` : `border border-[${t.border}]`} ${card?.shadow ? `shadow-[${arb(card.shadow)}]` : d?.shadows[0] ? `shadow-[${arb(d.shadows[0].value)}]` : ""} \${className}\`}
      {...props}
    />
  );
}

export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={\`text-[${d?.textStyles.h3?.size || "20px"}] font-[${d?.textStyles.h3?.weight || 600}] text-[${d?.textStyles.h3?.color || t.fg}] \${className}\`} {...props} />;
}

export function CardText({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={\`mt-2 text-[${d?.textStyles.p?.size || "16px"}] leading-[${d?.textStyles.p?.lineHeight || "1.6"}] text-[${t.muted}] \${className}\`} {...props} />;
}
`;
  const navbar = `// Navbar.tsx — generated from ${host(s)} by Scrapper AI
import { Button } from "./Button";

const links = ["Products", "Solutions", "Pricing", "About"];

export function Navbar() {
  return (
    <header className="${header?.position === "fixed" || header?.position === "sticky" ? "sticky top-0 z-50 " : ""}bg-[${header?.bg || t.bg}] ${header?.borderBottom ? `border-b border-[${header.borderBottom.split(" ").pop()}]` : ""} ${header?.backdrop ? "backdrop-blur" : ""}">
      <nav className="mx-auto flex h-[${header?.height || "64px"}] max-w-[${d?.maxWidths[0]?.value || "1200px"}] items-center justify-between px-6 ${fontCls}">
        <a href="/" className="text-[18px] font-bold text-[${t.fg}]">${host(s).replace(/^www\./, "")}</a>
        <ul className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <li key={l}><a href="#" className="text-[${d?.link?.color || t.fg}] text-[${d?.textStyles.a?.size || "15px"}] hover:opacity-80">{l}</a></li>
          ))}
        </ul>
        <Button>${(variants[0].label || "Get started").replace(/"/g, "'")}</Button>
      </nav>
    </header>
  );
}
`;
  const inputCode = `// Input.tsx — generated from ${host(s)} by Scrapper AI
import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={\`w-full bg-[${input?.bg || t.bg}] text-[${input?.color || t.fg}] border border-[${t.border}] rounded-[${input?.radius && input.radius !== "0px" ? input.radius : t.radius}] ${input?.padding ? padClasses(input.padding) : "px-3 py-2"} text-[${input?.fontSize || "16px"}] outline-none placeholder:text-[${t.muted}] focus:border-[${t.accent}] focus:ring-2 focus:ring-[${t.accent}]/30 \${className}\`}
      {...props}
    />
  );
}
`;
  const demo = `// Example.tsx — all generated components together
import { Navbar } from "./Navbar";
import { Button } from "./Button";
import { Card, CardTitle, CardText } from "./Card";
import { Input } from "./Input";

export default function Example() {
  return (
    <div className="min-h-screen bg-[${t.bg}] text-[${t.fg}] ${fontCls}">
      <Navbar />
      <main className="mx-auto max-w-[${d?.maxWidths[0]?.value || "1200px"}] px-6 py-20">
        <h1 className="text-[${d?.textStyles.h1?.size || "48px"}] font-[${d?.textStyles.h1?.weight || 700}] leading-[${d?.textStyles.h1?.lineHeight || "1.1"}] tracking-[${d?.textStyles.h1?.letterSpacing && d.textStyles.h1.letterSpacing !== "normal" ? d.textStyles.h1.letterSpacing : "0"}]">Your headline</h1>
        <p className="mt-4 max-w-xl text-[${t.muted}]">Supporting text in the body style.</p>
        <div className="mt-8 flex gap-3">
${variants.map((v) => `          <Button variant="${v.name}">${v.label.replace(/"/g, "'")}</Button>`).join("\n")}
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardTitle>Card {i}</CardTitle><CardText>Short description.</CardText></Card>
          ))}
        </div>
        <div className="mt-12 max-w-sm"><Input placeholder="you@example.com" /></div>
      </main>
    </div>
  );
}
`;
  return [
    { name: "Button.tsx", lang: "tsx", code: button, note: `${variants.length} variant(s) from the buttons found on the site.` },
    { name: "Card.tsx", lang: "tsx", code: cardCode, note: "Card, CardTitle and CardText using the measured card style." },
    { name: "Navbar.tsx", lang: "tsx", code: navbar, note: "Header bar with the measured height, background and link style." },
    { name: "Input.tsx", lang: "tsx", code: inputCode, note: "Text input with focus ring in the accent colour." },
    { name: "Example.tsx", lang: "tsx", code: demo, note: "A demo page that uses all components." },
  ];
}
