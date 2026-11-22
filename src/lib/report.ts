/* Shared types + helpers that turn raw page results into one site summary. Pure TS (runs on client and server). */

export type Entry = [string, number];
export type MediaItem = { url: string; type: "image" | "gif" | "svg" | "background" | "video" | "audio" | "icon"; w?: number | null; h?: number | null; alt?: string; poster?: string | null; inline?: boolean; size?: number; mime?: string; source?: string };
type TextStyle = { font: string; size: string; weight: string; lineHeight: string; letterSpacing: string; color: string | null; transform: string | null };
type ButtonStyle = { text: string; bg: string | null; bgImage: string | null; color: string | null; border: string; radius: string; padding: string; fontSize: string; fontWeight: string; shadow: string | null; transition: string | null; height: string };
type BlockStyle = { bg: string | null; height: string; position: string; shadow: string | null; borderBottom: string | null; backdrop: string | null; links: number } | null;
export type DesignRaw = {
  spacing: Entry[]; radius: Entry[]; shadows: Entry[]; gradients: Entry[]; lineHeights: Entry[]; letterSpacing: Entry[]; maxWidths: Entry[];
  durations: Entry[]; easings: Entry[]; zIndex: Entry[];
  layout: { flex: number; grid: number; pageWidth: number; pageHeight: number };
  breakpoints: string[]; textStyles: Record<string, TextStyle>; buttons: ButtonStyle[];
  input: { bg: string | null; color: string | null; border: string; radius: string; padding: string; fontSize: string; height: string } | null;
  link: { color: string | null; decoration: string; weight: string } | null;
  cards: { bg: string | null; radius: string; shadow: string | null; border: string | null; padding: string }[];
  header: BlockStyle; footer: BlockStyle; icons: { svg: number; iconFont: boolean; imgs: number };
};
export type PageResult = {
  url: string; finalUrl?: string; status?: number | null; loadMs?: number; error?: string;
  lite?: boolean; // scanned in the lighter backup mode (very heavy page): no tablet/phone shots or accessibility check
  screenshot?: string; mobileScreenshot?: string | null; tabletScreenshot?: string | null; faviconData?: string | null;
  vitals?: { lcp: number | null; cls: number; tbt: number; fcp: number | null; ratings: Record<"lcp" | "cls" | "tbt" | "fcp", string> } | null;
  a11y?: { violations: { id: string; impact: string | null; help: string; description: string; helpUrl: string; count: number; targets: string[] }[]; passes: number } | null;
  colors?: { background: Entry[]; text: Entry[]; border: Entry[] };
  cssVars?: Record<string, string>;
  design?: DesignRaw;
  typography?: { families: Entry[]; sizes: Entry[]; weights: Entry[]; loadedFonts: string[]; fontFaces: string[] };
  animations?: {
    keyframes: string[]; cssAnimated: { el: string; name: string; duration: string; timing: string; iteration: string }[];
    transitionEls: number; transitionProps: Entry[]; running: { css: number; transitions: number; waapi: number };
    libraries: { name: string; version: string | null }[]; blockedSheets: number;
  };
  tech?: { name: string; version: string | null }[];
  seo?: {
    title: string; description: string | null; lang: string | null; canonical: string | null; robots: string | null; viewport: string | null;
    ogTitle: string | null; ogDescription: string | null; ogImage: string | null; twitterCard: string | null; favicon: string | null; icons?: { href: string; rel?: string; sizes?: string; type?: string }[];
    h1: string[]; h2: string[]; h3: string[]; wordCount: number; images: number; imagesNoAlt: number; jsonLd: string[];
  };
  links?: { href: string; text: string; blank: boolean; rel: string }[];
  media?: MediaItem[];
  forms?: { action: string; method: string; hasPassword: boolean }[];
  perf?: { ttfb: number | null; domContentLoaded: number | null; load: number | null; requests: number; transferKB: number; domNodes: number };
  requestsByType?: Record<string, number>;
  failedRequests?: string[];
  inlineScripts?: number;
  textSample?: string;
  security?: {
    https: boolean; mixedContent: string[]; insecureForms: { action: string }[]; passwordOnHttp: boolean;
    cookies: { name: string; secure: boolean; httpOnly: boolean; sameSite: string }[];
    thirdPartyDomains: string[]; blankNoopener: number;
    libIssues: { library: string; version: string; issue: string; fix: string; severity: string }[];
  };
};
export type SiteResult = {
  finalUrl: string; status: number; headers: Record<string, string>; error?: string;
  checks: { name: string; ok: boolean; severity: string; detail: string }[];
  ssl: Record<string, unknown> | null; hosting: string[]; robots: string | null; hasSitemap: boolean; compression: string | null;
};
export type LinksResult = { checked: number; total: number; blocked?: number; broken: { url: string; status: number | null; error?: string }[] };

const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dist = (a: string, b: string) => { const x = hexToRgb(a), y = hexToRgb(b); return Math.sqrt(x.reduce((s, v, i) => s + (v - y[i]) ** 2, 0)); };
export const luminance = (h: string) => { const [r, g, b] = hexToRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string, b: string) => { const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
const saturation = (h: string) => { const [r, g, b] = hexToRgb(h); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };

function merge(lists: Entry[][], cluster = false, n = 12): Entry[] {
  const m: Record<string, number> = {};
  for (const l of lists) for (const [k, v] of l || []) m[k] = (m[k] || 0) + v;
  let arr = Object.entries(m).sort((a, b) => b[1] - a[1]);
  if (cluster) {
    const out: Entry[] = [];
    for (const [k, v] of arr) {
      const near = out.find(([o]) => dist(o, k) < 18);
      if (near) near[1] += v; else out.push([k, v]);
    }
    arr = out.sort((a, b) => b[1] - a[1]);
  }
  return arr.slice(0, n);
}
const pct = (list: Entry[]) => { const t = list.reduce((s, [, v]) => s + v, 0) || 1; return list.map(([k, v]) => ({ value: k, share: Math.round((v / t) * 1000) / 10 })); };

export function buildSummary(pages: PageResult[], site: SiteResult | null, links: LinksResult | null) {
  const ok = pages.filter((p) => !p.error && p.colors);
  const bg = merge(ok.map((p) => p.colors!.background), true, 10);
  const text = merge(ok.map((p) => p.colors!.text), true, 8);
  const border = merge(ok.map((p) => p.colors!.border), true, 5);
  const all = merge([bg, text, border].map((l) => l.map(([k]) => [k, 1] as Entry)), true, 30).map(([k]) => k);
  const accents = all.filter((c) => saturation(c) > 0.35).slice(0, 6);

  const palette = {
    backgrounds: pct(bg), text: pct(text), borders: pct(border), accents,
    primaryBg: bg[0]?.[0] ?? "#ffffff", primaryText: text[0]?.[0] ?? "#000000",
    cssVars: Object.fromEntries(Object.entries(ok[0]?.cssVars || {}).slice(0, 40)),
  };
  const typography = {
    families: pct(merge(ok.map((p) => p.typography!.families), false, 6)),
    sizes: pct(merge(ok.map((p) => p.typography!.sizes), false, 10)).sort((a, b) => parseFloat(b.value) - parseFloat(a.value)),
    weights: pct(merge(ok.map((p) => p.typography!.weights), false, 6)),
    loadedFonts: [...new Set(ok.flatMap((p) => p.typography!.loadedFonts))].slice(0, 20),
  };

  const libMap = new Map<string, string | null>();
  ok.forEach((p) => p.animations!.libraries.forEach((l) => libMap.set(l.name, l.version || libMap.get(l.name) || null)));
  const animations = {
    libraries: [...libMap].map(([name, version]) => ({ name, version })),
    keyframes: [...new Set(ok.flatMap((p) => p.animations!.keyframes))].slice(0, 40),
    animatedElements: ok.flatMap((p) => p.animations!.cssAnimated.map((a) => ({ ...a, page: p.url }))).slice(0, 40),
    transitionElements: ok.reduce((s, p) => s + p.animations!.transitionEls, 0),
    transitionProps: merge(ok.map((p) => p.animations!.transitionProps), false, 8).map(([k]) => k),
    running: ok.reduce((s, p) => ({ css: s.css + p.animations!.running.css, transitions: s.transitions + p.animations!.running.transitions, waapi: s.waapi + p.animations!.running.waapi }), { css: 0, transitions: 0, waapi: 0 }),
    blockedSheets: Math.max(0, ...ok.map((p) => p.animations!.blockedSheets)),
  };

  const techMap = new Map<string, string | null>();
  ok.forEach((p) => p.tech!.forEach((t) => techMap.set(t.name, t.version || techMap.get(t.name) || null)));
  const tech = [...techMap].map(([name, version]) => ({ name, version }));

  // SEO issues per page
  const titleCount: Record<string, number> = {};
  ok.forEach((p) => { titleCount[p.seo!.title] = (titleCount[p.seo!.title] || 0) + 1; });
  const seoPages = ok.map((p) => {
    const s = p.seo!; const issues: string[] = [];
    if (!s.title) issues.push("Missing <title>");
    else if (s.title.length > 60) issues.push(`Title is long (${s.title.length} chars, aim ≤ 60)`);
    else if (s.title.length < 15) issues.push(`Title is short (${s.title.length} chars)`);
    if (s.title && titleCount[s.title] > 1) issues.push("Title is used on more than one page");
    if (!s.description) issues.push("Missing meta description");
    else if (s.description.length > 160) issues.push(`Meta description is long (${s.description.length} chars, aim ≤ 160)`);
    if (s.h1.length === 0) issues.push("No H1 heading");
    if (s.h1.length > 1) issues.push(`${s.h1.length} H1 headings (use one)`);
    if (s.imagesNoAlt > 0) issues.push(`${s.imagesNoAlt} of ${s.images} images have no alt text`);
    if (!s.canonical) issues.push("No canonical link");
    if (!s.ogTitle || !s.ogImage) issues.push("Open Graph tags incomplete (og:title / og:image)");
    if (!s.lang) issues.push("No lang attribute on <html>");
    if (!s.viewport) issues.push("No viewport meta tag (bad on mobile)");
    if (s.robots && /noindex/i.test(s.robots)) issues.push("Page is set to noindex");
    if (s.wordCount < 150) issues.push(`Thin content (${s.wordCount} words)`);
    return { url: p.url, issues };
  });

  // Security: site checks + per page
  const sec = {
    checks: site?.checks || [],
    ssl: site?.ssl || null,
    mixedContent: [...new Set(ok.flatMap((p) => p.security!.mixedContent))].slice(0, 20),
    insecureForms: ok.flatMap((p) => p.security!.insecureForms.map((f) => f.action)),
    passwordOnHttp: ok.some((p) => p.security!.passwordOnHttp),
    cookies: [...new Map(ok.flatMap((p) => p.security!.cookies).map((c) => [c.name, c])).values()],
    libIssues: [...new Map(ok.flatMap((p) => p.security!.libIssues).map((i) => [i.library + i.version, i])).values()],
    thirdPartyDomains: [...new Set(ok.flatMap((p) => p.security!.thirdPartyDomains))].slice(0, 40),
    blankNoopener: ok.reduce((s, p) => s + p.security!.blankNoopener, 0),
  };
  const failedSec = sec.checks.filter((c) => !c.ok);
  const score = Math.max(0, 100
    - failedSec.reduce((s, c) => s + (c.severity === "high" ? 20 : c.severity === "medium" ? 10 : c.severity === "low" ? 4 : 1), 0)
    - (sec.mixedContent.length ? 10 : 0) - sec.insecureForms.length * 10 - (sec.passwordOnHttp ? 20 : 0)
    - sec.libIssues.reduce((s, i) => s + (i.severity === "high" ? 15 : i.severity === "medium" ? 8 : 3), 0));

  const perfPages = ok.map((p) => ({ url: p.url, loadMs: p.loadMs || 0, ...p.perf! }));
  const avgLoad = perfPages.length ? Math.round(perfPages.reduce((s, p) => s + (p.load || p.loadMs), 0) / perfPages.length) : 0;

  // Design tokens merged across pages
  const ds = ok.map((p) => p.design).filter(Boolean) as DesignRaw[];
  const h = ds[0];
  const px = (v: string) => parseFloat(v) || 0;
  const spacing = merge(ds.map((d) => d.spacing), false, 16).sort((a, b) => px(a[0]) - px(b[0]));
  const spacingVals = spacing.map(([v]) => px(v));
  const on8 = spacingVals.filter((v) => v % 8 === 0).length, on4 = spacingVals.filter((v) => v % 4 === 0).length;
  const cardMap = new Map<string, DesignRaw["cards"][number] & { count: number }>();
  ds.flatMap((d) => d.cards).forEach((c) => { const k = [c.bg, c.radius, c.shadow, c.border].join("|"); const e = cardMap.get(k); if (e) e.count++; else cardMap.set(k, { ...c, count: 1 }); });
  const btnMap = new Map<string, DesignRaw["buttons"][number]>();
  ds.flatMap((d) => d.buttons).forEach((b) => { const k = [b.bg, b.bgImage, b.color, b.border, b.radius].join("|"); if (!btnMap.has(k)) btnMap.set(k, b); });
  const bpNum = (b: string) => parseFloat(b.split(":")[1]) * (/em/.test(b) ? 16 : 1);
  const design = h ? {
    spacing: pct(spacing), spacingBase: on8 >= spacingVals.length * 0.6 ? 8 : on4 >= spacingVals.length * 0.6 ? 4 : null,
    radius: pct(merge(ds.map((d) => d.radius), false, 8)).sort((a, b) => px(a.value) - px(b.value)),
    shadows: pct(merge(ds.map((d) => d.shadows), false, 6)),
    gradients: merge(ds.map((d) => d.gradients), false, 5).map(([v]) => v),
    lineHeights: pct(merge(ds.map((d) => d.lineHeights), false, 5)),
    letterSpacing: pct(merge(ds.map((d) => d.letterSpacing), false, 5)),
    maxWidths: pct(merge(ds.map((d) => d.maxWidths), false, 5)),
    durations: pct(merge(ds.map((d) => d.durations), false, 6)),
    easings: pct(merge(ds.map((d) => d.easings), false, 5)),
    zIndex: merge(ds.map((d) => d.zIndex), false, 8).map(([v]) => v).sort((a, b) => +a - +b),
    breakpoints: [...new Set(ds.flatMap((d) => d.breakpoints))].sort((a, b) => bpNum(a) - bpNum(b)).slice(0, 16),
    textStyles: h.textStyles, buttons: [...btnMap.values()].slice(0, 6), input: ds.find((d) => d.input)?.input || null,
    link: h.link, cards: [...cardMap.values()].sort((a, b) => b.count - a.count).slice(0, 4),
    header: h.header, footer: h.footer, layout: h.layout, icons: h.icons,
  } : null;

  return {
    url: pages[0]?.url, pagesAnalyzed: ok.length, pagesFailed: pages.length - ok.length,
    palette, typography, animations, tech, hosting: site?.hosting || [], design,
    seoScore: seoPages.length ? Math.round(seoPages.reduce((t, p) => t + Math.max(0, 100 - p.issues.length * 8), 0) / seoPages.length) - (site?.hasSitemap === false ? 5 : 0) : 0,
    seo: { pages: seoPages, hasSitemap: site?.hasSitemap ?? false, hasRobots: !!site?.robots },
    security: { ...sec, score },
    performance: { avgLoadMs: avgLoad, pages: perfPages, compression: site?.compression || null },
    brokenLinks: links?.broken || [], linksChecked: links?.checked || 0, linksBlocked: links?.blocked || 0,
  };
}
export type Summary = ReturnType<typeof buildSummary>;

/** Rule-based suggestions (used when no AI key, and as extra facts for the AI). */
export function ruleSuggestions(s: Summary) {
  const out: { area: string; priority: "high" | "medium" | "low"; title: string; detail: string }[] = [];
  for (const c of s.security.checks.filter((c) => !c.ok && c.severity !== "info"))
    out.push({ area: "Security", priority: c.severity === "high" ? "high" : c.severity === "medium" ? "medium" : "low", title: `Fix: ${c.name}`, detail: c.detail });
  for (const i of s.security.libIssues) out.push({ area: "Security", priority: i.severity as "high", title: `Update ${i.library} ${i.version}`, detail: `${i.issue}. ${i.fix}.` });
  if (s.security.mixedContent.length) out.push({ area: "Security", priority: "high", title: "Remove mixed content", detail: `${s.security.mixedContent.length} resources load over http:// on https pages.` });
  const weakCookies = s.security.cookies.filter((c) => !c.secure);
  if (weakCookies.length) out.push({ area: "Security", priority: "low", title: "Mark cookies Secure", detail: `${weakCookies.length} cookies lack the Secure flag: ${weakCookies.slice(0, 5).map((c) => c.name).join(", ")}` });
  if (s.brokenLinks.length) out.push({ area: "Content", priority: "medium", title: `Fix ${s.brokenLinks.length} broken links`, detail: s.brokenLinks.slice(0, 5).map((b) => `${b.url} (${b.status ?? b.error})`).join("; ") });
  const seoCount: Record<string, number> = {};
  s.seo.pages.forEach((p) => p.issues.forEach((i) => { const k = i.replace(/\d+/g, "N"); seoCount[k] = (seoCount[k] || 0) + 1; }));
  Object.entries(seoCount).sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([k, n]) => out.push({ area: "SEO", priority: /noindex|Missing <title>|No H1/.test(k) ? "high" : "medium", title: k.replace(/N/g, "#"), detail: `Found on ${n} page(s).` }));
  if (!s.seo.hasSitemap) out.push({ area: "SEO", priority: "medium", title: "Add a sitemap.xml", detail: "No sitemap found at /sitemap.xml." });
  if (s.performance.avgLoadMs > 4000) out.push({ area: "Performance", priority: "high", title: "Pages load slowly", detail: `Average full load ${(s.performance.avgLoadMs / 1000).toFixed(1)}s. Compress images, defer scripts, use a CDN.` });
  const heavy = s.performance.pages.filter((p) => p.transferKB > 3000);
  if (heavy.length) out.push({ area: "Performance", priority: "medium", title: "Heavy pages", detail: heavy.map((p) => `${p.url}: ${(p.transferKB / 1024).toFixed(1)} MB`).join("; ") });
  if (s.typography.families.length > 4) out.push({ area: "Design", priority: "low", title: "Too many font families", detail: `${s.typography.families.length} families in use. 2–3 is usually cleaner and faster.` });
  const bg = s.palette.primaryBg, tx = s.palette.primaryText;
  const cr = contrast(bg, tx);
  if (cr < 4.5) out.push({ area: "Accessibility", priority: "high", title: "Low text contrast", detail: `Main text ${tx} on ${bg} has contrast ${cr.toFixed(2)}:1 (WCAG AA needs 4.5:1).` });
  return out;
}

export { buildDesignMd } from "./designMd";
