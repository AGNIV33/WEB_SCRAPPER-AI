import { contrast, luminance, type Summary } from "./report";

const rem = (px: string) => (parseFloat(px) / 16).toFixed(3).replace(/\.?0+$/, "") + "rem";

/** design.md built straight from measured data (always available, no AI needed). Detailed and factual. */
export function buildDesignMd(s: Summary) {
  const L: string[] = [];
  const push = (...x: string[]) => { L.push(...x); };
  const host = s.url ? new URL(s.url).hostname : "site";
  const d = s.design;
  const fam = s.typography.families;
  const stack = fam.length ? `${fam.slice(0, 2).map((f) => `"${f.value}"`).join(", ")}, system-ui, -apple-system, "Segoe UI", sans-serif` : "system-ui, sans-serif";
  const bg = s.palette.primaryBg, fg = s.palette.primaryText;
  // Accent: first saturated colour that is actually visible on the background (contrast >= 3)
  const visibleAccents = s.palette.accents.filter((c) => contrast(bg, c) >= 3);
  const accent = visibleAccents[0] || s.palette.accents[0] || d?.buttons.find((b) => b.bg && b.bg !== bg)?.bg || fg;
  const accent2 = visibleAccents[1] || null;
  const surface = s.palette.backgrounds.find((c) => c.value !== bg)?.value || bg;
  // Muted text: a common text colour with lower contrast than the main text
  const muted = s.palette.text.find((c) => c.value !== fg && contrast(bg, c.value) < contrast(bg, fg) && contrast(bg, c.value) >= 2)?.value || s.palette.text.find((c) => c.value !== fg)?.value || fg;
  const border = s.palette.borders[0]?.value || null;
  const isDark = luminance(bg) < 0.2;
  const cr = contrast(bg, fg);
  if (d?.link && d.link.color && contrast(bg, d.link.color) < 3 && d.textStyles.a?.color) d.link = { ...d.link, color: d.textStyles.a.color };
  const topRadius = d?.radius.length ? [...d.radius].sort((a, b) => b.share - a.share)[0].value : null;

  push(`# Design System: ${host}`, "");
  push(`> Auto-extracted from **${s.pagesAnalyzed} page(s)** of ${s.url} by Scrapper AI.`, "> Values are measured from the live site (computed styles). Items marked *(suggested)* are recommendations.", "");
  // A short brief first, so a developer or an AI model (Claude, GPT…) gets the whole idea in 10 seconds.
  const pBtn = d?.buttons[0];
  push("## Quick brief (read this first)", "");
  push(`Recreate the look of **${host}**: a ${isDark ? "dark" : "light"} interface on \`${bg}\` with \`${fg}\` text, set in **${fam[0]?.value || "a sans-serif"}**${fam[1] ? ` with **${fam[1].value}** as secondary font` : ""}. ` +
    `The accent colour is \`${accent}\`${accent2 ? ` (second accent \`${accent2}\`)` : ""}, used for buttons, links and highlights. ` +
    `${d ? `Spacing follows a ${d.spacingBase ? `${d.spacingBase}px` : "4px"} grid, content is ${d.maxWidths[0]?.value ? `at most ${d.maxWidths[0].value} wide` : "full width"}, corners are ${topRadius || "square"} and the design uses ${d.shadows.length ? "soft shadows" : "no shadows (flat)"}. ` : ""}` +
    `${pBtn ? `Primary buttons: ${pBtn.bgImage ? "gradient" : `\`${pBtn.bg ?? "transparent"}\``} background, \`${pBtn.color}\` text, ${pBtn.radius} radius, ${pBtn.padding} padding, ${pBtn.fontSize}/${pBtn.fontWeight}. ` : ""}` +
    `Motion: ${s.animations.libraries.length ? s.animations.libraries.map((l) => l.name).join(", ") : "CSS transitions only"}.`);
  push("", "**How to use this file:** give it to a developer or paste it into an AI assistant with: *\"Build a page using this design.md. Use exactly these colours, fonts, sizes, spacing and component styles.\"* The CSS tokens (section 10), the Tailwind config (section 11) and the starter code (section 14) can be copied directly.", "");
  push("## Contents", "", "1. Overview", "2. Color palette", "3. Typography", "4. Spacing & layout", "5. Shape: radius, borders, shadows", "6. Components", "7. Motion & animation", "8. Iconography & imagery", "9. Accessibility", "10. Design tokens (CSS)", "11. Tailwind config", "12. Do's and don'ts", "13. Tech stack", "14. Starter code (HTML + CSS)", "");

  // 1
  push("## 1. Overview", "");
  push(`- **Theme:** ${isDark ? "Dark" : "Light"} (background \`${bg}\`, text \`${fg}\`)`);
  push(`- **Primary font:** ${fam[0]?.value || "n/a"}${fam[1] ? ` · secondary: ${fam[1].value}` : ""}`);
  push(`- **Accent:** \`${accent}\`${accent2 ? ` · second accent \`${accent2}\`` : ""}`);
  if (d) {
    push(`- **Layout:** ${d.layout.flex} flex and ${d.layout.grid} grid containers · content width ${d.maxWidths[0]?.value || "full width"}`);
    push(`- **Spacing grid:** ${d.spacingBase ? `${d.spacingBase}px` : "no strict grid"}`);
    push(`- **Corners:** ${topRadius ? `mostly ${topRadius}` : "square"} · **Shadows:** ${d.shadows.length ? `${d.shadows.length} styles` : "none (flat)"}`);
  }
  push(`- **Motion:** ${s.animations.libraries.length ? s.animations.libraries.map((l) => l.name).join(", ") : "CSS only"} · ${s.animations.keyframes.length} keyframes · ${s.animations.transitionElements} elements with transitions`, "");

  // 2
  push("## 2. Color palette", "", "### Core roles", "", "| Role | Hex | Notes |", "|---|---|---|");
  const row = (role: string, hex: string | null, note: string) => { if (hex) push(`| ${role} | \`${hex}\` | ${note} |`); };
  row("Background", bg, `${s.palette.backgrounds[0]?.share ?? 0}% of screen area`);
  row("Surface", surface, "cards, sections, alternate backgrounds");
  row("Text (primary)", fg, `${s.palette.text[0]?.share ?? 0}% of text · ${cr.toFixed(2)}:1 on background`);
  row("Text (muted)", muted, `${contrast(bg, muted).toFixed(2)}:1 on background`);
  row("Accent / primary action", accent, "buttons, links, highlights");
  if (accent2) row("Accent 2", accent2, "secondary highlights");
  if (border) row("Border", border, `${s.palette.borders[0]?.share ?? 0}% of borders`);
  if (d?.link?.color) row("Link", d.link.color, `decoration ${d.link.decoration}, weight ${d.link.weight}`);
  push("", "### All background colours (by screen area)", "", "| Hex | Share |", "|---|---|", ...s.palette.backgrounds.map((c) => `| \`${c.value}\` | ${c.share}% |`));
  push("", "### All text colours (by amount of text)", "", "| Hex | Share | Contrast on background |", "|---|---|---|", ...s.palette.text.map((c) => `| \`${c.value}\` | ${c.share}% | ${contrast(bg, c.value).toFixed(2)}:1 |`));
  if (s.palette.borders.length) push("", "### Border colours", "", s.palette.borders.map((c) => `\`${c.value}\` (${c.share}%)`).join(" · "));
  if (s.palette.accents.length) push("", "### Accent colours", "", s.palette.accents.map((c) => `\`${c}\``).join(" · "));
  if (d?.gradients.length) push("", "### Gradients", "", ...d.gradients.map((g) => `- \`${g}\``));
  const vars = Object.entries(s.palette.cssVars);
  if (vars.length) push("", "### CSS custom properties on :root", "", "```css", ":root {", ...vars.slice(0, 40).map(([k, v]) => `  ${k}: ${v};`), "}", "```");
  push("");

  // 3
  push("## 3. Typography", "", "### Font families", "");
  fam.forEach((f, i) => push(`- **${i === 0 ? "Primary" : i === 1 ? "Secondary" : "Other"}:** ${f.value} (${f.share}% of text)`));
  push("", `**Font stack:** \`font-family: ${stack};\``);
  if (s.typography.loadedFonts.length) push("", `**Font files loaded:** ${s.typography.loadedFonts.join(", ")}`);
  if (d && Object.keys(d.textStyles).length) {
    push("", "### Text styles (measured on the homepage)", "", "| Element | Font | Size | Weight | Line height | Letter spacing | Color | Case |", "|---|---|---|---|---|---|---|---|");
    Object.entries(d.textStyles).forEach(([tag, t]) => push(`| \`${tag}\` | ${t.font} | ${t.size} (${rem(t.size)}) | ${t.weight} | ${t.lineHeight} | ${t.letterSpacing} | \`${t.color}\` | ${t.transform || "—"} |`));
  }
  push("", "### Type scale (all sizes used)", "", "| Size | rem | Share of text |", "|---|---|---|", ...s.typography.sizes.map((x) => `| ${x.value} | ${rem(x.value)} | ${x.share}% |`));
  push("", `**Weights:** ${s.typography.weights.map((w) => `${w.value} (${w.share}%)`).join(", ")}`);
  if (d?.lineHeights.length) push("", `**Line heights (ratio to font size):** ${d.lineHeights.map((l) => `${l.value} ${l.share}%`).join(", ")}`);
  if (d?.letterSpacing.length) push("", `**Letter spacing used:** ${d.letterSpacing.map((l) => l.value).join(", ")}`);
  push("");

  if (d) {
    // 4
    push("## 4. Spacing & layout", "");
    push(`- **Base unit:** ${d.spacingBase ? `${d.spacingBase}px (most spacing values are multiples of ${d.spacingBase})` : "no strict grid detected; 4px *(suggested)*"}`);
    push(`- **Spacing values used:** ${d.spacing.map((x) => x.value).join(", ")}`);
    push(`- **Container max-widths:** ${d.maxWidths.length ? d.maxWidths.map((m) => `${m.value} (${m.share}%)`).join(", ") : "none (full width)"}`);
    push(`- **Page size at 1280px wide:** ${d.layout.pageWidth} × ${d.layout.pageHeight}px`);
    push(`- **Breakpoints (@media):** ${d.breakpoints.length ? d.breakpoints.map((b) => `\`${b}\``).join(", ") : "not readable (cross-origin CSS); 640 / 768 / 1024 / 1280px *(suggested)*"}`);
    if (d.zIndex.length) push(`- **z-index layers:** ${d.zIndex.join(", ")}`);
    push("", "| Token | Value | Share |", "|---|---|---|", ...d.spacing.slice(0, 14).map((x, i) => `| \`--space-${i + 1}\` | ${x.value} | ${x.share}% |`), "");

    // 5
    push("## 5. Shape: radius, borders, shadows", "", "### Border radius", "");
    push(d.radius.length ? d.radius.map((r) => `- \`${r.value}\` (${r.share}% of rounded elements)`).join("\n") : "- None: square corners.");
    push("", "### Shadows", "", d.shadows.length ? d.shadows.map((x) => `- \`${x.value}\` (${x.share}%)`).join("\n") : "- None: flat design.");
    if (border) push("", "### Borders", "", `- Main border colour \`${border}\``);
    push("");

    // 6
    push("## 6. Components", "");
    if (d.buttons.length) {
      push("### Buttons", "", "| Label | Background | Text | Border | Radius | Padding | Font | Height | Shadow |", "|---|---|---|---|---|---|---|---|---|");
      d.buttons.forEach((b) => push(`| ${b.text.replace(/\s+/g, " ").replace(/\|/g, "/")} | ${b.bgImage ? "gradient" : `\`${b.bg ?? "transparent"}\``} | \`${b.color}\` | ${b.border} | ${b.radius} | ${b.padding} | ${b.fontSize} / ${b.fontWeight} | ${b.height} | ${b.shadow ? "yes" : "no"} |`));
      const pb = d.buttons[0];
      push("", "**Primary button CSS:**", "", "```css", ".btn-primary {", `  background: ${pb.bgImage || pb.bg || "transparent"};`, `  color: ${pb.color};`, `  border: ${pb.border};`, `  border-radius: ${pb.radius};`, `  padding: ${pb.padding};`, `  font-size: ${pb.fontSize};`, `  font-weight: ${pb.fontWeight};`);
      if (pb.shadow) push(`  box-shadow: ${pb.shadow};`);
      if (pb.transition) push(`  transition: ${pb.transition};`);
      push("}", "```", "");
    }
    if (d.cards.length) {
      push("### Cards / panels", "", "| Background | Radius | Border | Shadow | Padding | Seen |", "|---|---|---|---|---|---|");
      d.cards.forEach((c) => push(`| \`${c.bg}\` | ${c.radius} | ${c.border || "none"} | ${c.shadow ? `\`${c.shadow}\`` : "none"} | ${c.padding} | ${c.count}× |`));
      push("");
    }
    if (d.input) push("### Inputs", "", `- Background \`${d.input.bg}\`, text \`${d.input.color}\`, border ${d.input.border}, radius ${d.input.radius}, padding ${d.input.padding}, font ${d.input.fontSize}, height ${d.input.height}`, "");
    if (d.header) push("### Header / navigation", "", `- Background \`${d.header.bg ?? "transparent"}\`, height ${d.header.height}, position \`${d.header.position}\`${d.header.backdrop ? `, backdrop \`${d.header.backdrop}\`` : ""}${d.header.shadow ? ", has shadow" : ""}${d.header.borderBottom ? `, bottom border ${d.header.borderBottom}` : ""}, ${d.header.links} links`, "");
    if (d.footer) push("### Footer", "", `- Background \`${d.footer.bg ?? "transparent"}\`, height ${d.footer.height}, ${d.footer.links} links`, "");
    if (d.link) push("### Links", "", `- Colour \`${d.link.color}\`, decoration \`${d.link.decoration}\`, weight ${d.link.weight}`, "");
  }

  // 7
  push("## 7. Motion & animation", "");
  push(`- **Libraries:** ${s.animations.libraries.length ? s.animations.libraries.map((l) => l.name + (l.version ? ` ${l.version}` : "")).join(", ") : "none detected (CSS only)"}`);
  push(`- **@keyframes:** ${s.animations.keyframes.length ? s.animations.keyframes.slice(0, 25).map((k) => `\`${k}\``).join(", ") : "none found"}`);
  push(`- **Elements with transitions:** ${s.animations.transitionElements}`);
  push(`- **Properties that animate:** ${s.animations.transitionProps.join(", ") || "n/a"}`);
  if (d?.durations.length) push(`- **Durations:** ${d.durations.map((x) => `${x.value} (${x.share}%)`).join(", ")}`);
  if (d?.easings.length) push(`- **Easing curves:** ${d.easings.map((x) => `\`${x.value}\``).join(", ")}`);
  if (s.animations.animatedElements.length) {
    push("", "| Element | Animation | Duration | Easing | Repeat |", "|---|---|---|---|---|");
    s.animations.animatedElements.slice(0, 15).forEach((a) => push(`| \`${a.el}\` | ${a.name} | ${a.duration} | ${a.timing} | ${a.iteration} |`));
  }
  push("");

  // 8
  if (d) push("## 8. Iconography & imagery", "", `- Inline SVGs on homepage: ${d.icons.svg}`, `- Icon font: ${d.icons.iconFont ? "yes" : "no"}`, `- Images on homepage: ${d.icons.imgs}`, "");

  // 9
  push("## 9. Accessibility", "");
  push(`- Main text contrast **${cr.toFixed(2)}:1**: ${cr >= 7 ? "passes AAA" : cr >= 4.5 ? "passes AA" : "fails WCAG AA (needs 4.5:1)"}`);
  const mc = contrast(bg, muted);
  push(`- Muted text contrast **${mc.toFixed(2)}:1**: ${mc >= 4.5 ? "passes AA" : "below 4.5:1, use only for large text"}`);
  push(`- Accent on background **${contrast(bg, accent).toFixed(2)}:1**`);
  const noAlt = s.seo.pages.filter((p) => p.issues.some((i) => /alt text/.test(i))).length;
  if (noAlt) push(`- ${noAlt} page(s) have images without alt text`);
  push("");

  // 10
  push("## 10. Design tokens (CSS)", "", "```css", ":root {");
  push(`  --color-bg: ${bg};`, `  --color-surface: ${surface};`, `  --color-text: ${fg};`, `  --color-text-muted: ${muted};`, `  --color-accent: ${accent};`);
  if (accent2) push(`  --color-accent-2: ${accent2};`);
  if (border) push(`  --color-border: ${border};`);
  push(`  --font-sans: ${stack};`);
  [...s.typography.sizes].sort((a, b) => parseFloat(a.value) - parseFloat(b.value)).forEach((x, i) => push(`  --text-${i + 1}: ${rem(x.value)}; /* ${x.value} */`));
  d?.spacing.slice(0, 12).forEach((x, i) => push(`  --space-${i + 1}: ${x.value};`));
  d?.radius.slice(0, 5).forEach((x, i) => push(`  --radius-${i + 1}: ${x.value};`));
  d?.shadows.slice(0, 3).forEach((x, i) => push(`  --shadow-${i + 1}: ${x.value};`));
  if (d?.durations[0]) push(`  --duration: ${d.durations[0].value};`);
  if (d?.easings[0]) push(`  --ease: ${d.easings[0].value};`);
  push("}", "```", "");

  // 11
  push("## 11. Tailwind config", "", "```js", "// tailwind.config.js", "export default {", "  theme: {", "    extend: {");
  push(`      colors: { bg: "${bg}", surface: "${surface}", text: "${fg}", muted: "${muted}", accent: "${accent}"${accent2 ? `, accent2: "${accent2}"` : ""}${border ? `, border: "${border}"` : ""} },`);
  push(`      fontFamily: { sans: [${[...fam.slice(0, 2).map((f) => `"${f.value}"`), '"system-ui"', '"sans-serif"'].join(", ")}] },`);
  if (d?.radius.length) push(`      borderRadius: { ${d.radius.slice(0, 4).map((r, i) => `${["sm", "md", "lg", "xl"][i]}: "${r.value}"`).join(", ")} },`);
  if (d?.shadows.length) push(`      boxShadow: { ${d.shadows.slice(0, 2).map((x, i) => `${i ? "lg" : "card"}: "${x.value.replace(/"/g, "'")}"`).join(", ")} },`);
  if (d?.maxWidths[0]) push(`      maxWidth: { container: "${d.maxWidths[0].value}" },`);
  push("    },", "  },", "};", "```", "");

  // 12
  push("## 12. Do's and don'ts", "");
  push(`- ✅ Use \`${accent}\` for actions and highlights; keep large areas \`${bg}\` / \`${surface}\`.`);
  push(`- ✅ Body text: ${fam[0]?.value || "primary font"} at ${d?.textStyles.p?.size || "16px"}${d?.textStyles.p ? `, line-height ${d.textStyles.p.lineHeight}` : ""}.`);
  if (d?.spacingBase) push(`- ✅ Stick to the ${d.spacingBase}px spacing grid.`);
  if (d?.radius.length) push(`- ✅ Reuse the existing radii (${d.radius.slice(0, 3).map((r) => r.value).join(", ")}).`);
  push(`- ❌ Don't add new font families (the site already uses ${fam.length}).`);
  if (cr < 4.5) push(`- ❌ Don't use \`${fg}\` on \`${bg}\` for small text: contrast is too low.`);
  push("- ❌ Don't invent new colours outside this palette.", "");

  // 13
  push("## 13. Tech stack", "", ...(s.tech.length ? s.tech.map((t) => `- ${t.name}${t.version ? ` ${t.version}` : ""}`) : ["- Nothing detected"]), ...s.hosting.map((x) => `- ${x}`), "");

  // 14. Starter code: real CSS + HTML using the measured values, ready to copy
  const ts = d?.textStyles || {};
  const tsCss = (sel: string, t?: { font: string; size: string; weight: string; lineHeight: string; letterSpacing: string; color: string | null; transform: string | null }) =>
    t ? [`${sel} {`, `  font-size: ${rem(t.size)}; /* ${t.size} */`, `  font-weight: ${t.weight};`, `  line-height: ${t.lineHeight};`, ...(t.letterSpacing !== "normal" ? [`  letter-spacing: ${t.letterSpacing};`] : []), ...(t.color ? [`  color: ${t.color};`] : []), ...(t.transform ? [`  text-transform: ${t.transform};`] : []), "}"] : [];
  const card0 = d?.cards[0];
  const pad = d?.spacing.find((x) => parseFloat(x.value) >= 16)?.value || "16px";
  const gfonts = fam.slice(0, 2).map((f) => f.value).filter((f) => !/system|arial|helvetica|segoe|times|georgia|sans-serif|serif/i.test(f));
  push("## 14. Starter code (HTML + CSS)", "");
  if (gfonts.length) push(`Fonts: if **${gfonts.join("** / **")}** are not available, load them (e.g. from Google Fonts if they exist there) or use the fallback stack below.`, "");
  push("```css", "/* Base styles built from the measured design */", ":root { color-scheme: " + (isDark ? "dark" : "light") + "; }", "body {", `  margin: 0;`, `  background: ${bg};`, `  color: ${fg};`, `  font-family: ${stack};`,
    ...(ts.p ? [`  font-size: ${rem(ts.p.size)};`, `  line-height: ${ts.p.lineHeight};`] : []), "}",
    ...(["h1", "h2", "h3", "h4", "h5", "h6"] as const).flatMap((h) => tsCss(h, ts[h])),
    `a { color: ${d?.link?.color || accent}; text-decoration: ${d?.link?.decoration || "none"}; }`,
    `.container { max-width: ${d?.maxWidths[0]?.value || "1200px"}; margin: 0 auto; padding: 0 ${pad}; }`,
    ".btn {", `  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;`,
    `  background: ${pBtn?.bgImage || pBtn?.bg || accent};`, `  color: ${pBtn?.color || "#ffffff"};`, `  border: ${pBtn?.border && pBtn.border !== "none" ? pBtn.border : "0"};`,
    `  border-radius: ${pBtn?.radius || topRadius || "8px"};`, `  padding: ${pBtn?.padding || "10px 20px"};`, `  font: ${pBtn?.fontWeight || 600} ${pBtn?.fontSize || "16px"}/1 inherit;`,
    `  transition: ${pBtn?.transition || "all .2s ease"};`, "}", ".btn:hover { filter: brightness(1.08); }", `.btn:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }`,
    ".card {", `  background: ${card0?.bg || surface};`, `  border-radius: ${card0?.radius || topRadius || "12px"};`, `  padding: ${card0?.padding && card0.padding !== "0px" ? card0.padding : pad};`,
    ...(card0?.border ? [`  border: ${card0.border};`] : border ? [`  border: 1px solid ${border};`] : []), ...(card0?.shadow ? [`  box-shadow: ${card0.shadow};`] : d?.shadows[0] ? [`  box-shadow: ${d.shadows[0].value};`] : []), "}",
    "```", "");
  push("```html", "<!-- Example section using the classes above -->", "<header class=\"container\" style=\"display:flex;align-items:center;justify-content:space-between;padding-block:20px\">",
    `  <strong>${host}</strong>`, "  <nav style=\"display:flex;gap:24px\"><a href=\"#\">Products</a><a href=\"#\">About</a><a href=\"#\">Contact</a></nav>", "</header>",
    "<main class=\"container\">", "  <section style=\"padding-block:80px\">", "    <h1>Your main headline</h1>", "    <p>Short supporting paragraph in the body style.</p>",
    `    <a class="btn" href="#">${pBtn?.text || "Get started"}</a>`, "  </section>", "  <div style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:" + pad + "\">",
    "    <article class=\"card\"><h3>Card title</h3><p>Card text.</p></article>", "    <article class=\"card\"><h3>Card title</h3><p>Card text.</p></article>", "  </div>", "</main>", "```");
  return L.join("\n");
}
