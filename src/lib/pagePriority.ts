/**
 * Smart page priority (no AI): ranks the pages that /api/discover found, so the most important ones
 * are picked first, and groups near-duplicate pages that share one template (e.g. /product/*).
 * Pure functions, used on the server; the browser only reads the result.
 */

/** What discovery learned about one page. */
export type PageSignals = {
  url: string;
  depth?: number;        // clicks from the home page (undefined = only in the sitemap)
  inbound: number;       // how many crawled pages link to it
  nav: boolean;          // linked from a menu / header
  footer: boolean;       // linked from a footer
  smPriority?: number;   // <priority> in sitemap.xml (0..1)
  lastmod?: string;      // <lastmod> in sitemap.xml
};

/** One ranked page as sent to the browser. */
export type RankedPage = {
  url: string;
  score: number;
  section: string;       // first path part, e.g. "/blog" ("/" = home)
  why: string[];         // short reasons, e.g. ["menu", "key page"]
  group?: string;        // template pattern when part of a near-duplicate group, e.g. "/product/*"
  similar?: boolean;     // true = a near-duplicate that is skipped by default (a sample of its group is kept)
};

const KEY = /^(pricing|plans?|price|about(-us)?|company|team|products?|features?|contact(-us)?|services?|solutions?|docs?|documentation|developers?|api|support|help|faq|careers|jobs|shop|store|how-it-works|customers|case-studies|why-[a-z-]+|enterprise|platform|integrations?|security|download|demo)$/i;
const DEMOTE = /^(log-?in|sign-?in|sign-?up|signup|register|logout|log-?out|account|my-?account|profile|cart|basket|checkout|wishlist|tags?|author|authors|search|feed|rss|wp-admin|wp-login\.php|admin|amp|print|share|comments?|trackback|attachment|cdn-cgi)$/i;
const LEGAL = /^(privacy(-policy)?|terms(-of-(use|service))?|tos|cookies?(-policy)?|legal|disclaimer|imprint|impressum|gdpr|accessibility|sitemap)$/i;
const LOCALE = /^[a-z]{2}([-_][a-z]{2})?$/i;
const ID = /^(\d+|[0-9a-f]{8,}|[0-9a-f-]{20,}|.*\d{4,}.*)$/i;

const segs = (u: URL) => u.pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s).toLowerCase());

/** Path pattern used to find near-duplicates: ids become ":id", the last part becomes "*". */
export function templateOf(url: string): string | null {
  const u = new URL(url);
  const s = segs(u).map((x) => (ID.test(x) ? ":id" : x));
  if (s.length < 2) return u.search ? "/" + s.join("/") + "?*" : null;
  return "/" + s.slice(0, -1).join("/") + "/*";
}

export function sectionOf(url: string): string {
  const s = segs(new URL(url));
  return s.length ? "/" + s[0] : "/";
}

export function scorePage(p: PageSignals, rootUrl: string): { score: number; why: string[] } {
  const u = new URL(p.url);
  const root = new URL(rootUrl);
  const s = segs(u);
  const why: string[] = [];
  if (u.pathname.replace(/\/$/, "") === root.pathname.replace(/\/$/, "") && !u.search) return { score: 1000, why: ["home page"] };
  let score = 0;
  if (p.nav) { score += 30; why.push("menu"); }
  else if (p.footer) score += 6;
  if (p.inbound > 1) { score += Math.min(20, Math.round(6 * Math.log2(1 + p.inbound))); if (p.inbound >= 5) why.push(`linked ${p.inbound}×`); }
  if (p.depth !== undefined) score += Math.max(0, 20 - 6 * p.depth);
  else score -= 5;
  if (p.smPriority !== undefined) { score += Math.round((p.smPriority - 0.5) * 20); if (p.smPriority >= 0.8) why.push("sitemap: high"); }
  if (p.lastmod) { const t = Date.parse(p.lastmod); if (t && Date.now() - t < 365 * 86400_000) score += 3; }
  // Key business pages get a boost, mostly when they sit near the top of the site
  const keyIdx = s.findIndex((x) => KEY.test(x));
  if (keyIdx === 0 && s.length === 1) { score += 30; why.push("key page"); }
  else if (keyIdx >= 0) { score += s.length <= 2 ? 15 : 6; why.push("key page"); }
  else if (s.length === 1 && /^(blog|news|resources|learn|guides?)$/.test(s[0])) { score += 12; why.push("section page"); }
  // Login, cart, tag, search, pagination and other low-value pages go last
  if (s.some((x) => DEMOTE.test(x))) { score -= 40; why.push("low value"); }
  if (s.length && LEGAL.test(s[s.length - 1])) score -= 12;
  if (/(^|\/)page\/\d+/.test(u.pathname) || /[?&](page|p|paged|offset|start)=\d+/i.test(u.search)) { score -= 35; why.push("pagination"); }
  else if (u.search) { score -= 15; why.push("query link"); }
  if (s.length && LOCALE.test(s[0]) && !LOCALE.test(segs(root)[0] || "")) { score -= 12; why.push("other language"); }
  if (s.length > 3) score -= 3 * (s.length - 3);
  return { score, why };
}

/** Pages in a template group bigger than this are treated as near-duplicates. */
const GROUP_MIN = 6;
/** How many samples of each group are kept (ticked by default). */
const SAMPLES = 2;

/** Ranks pages (home first) and marks near-duplicates. Non-duplicates come before duplicates. */
export function rankPages(signals: PageSignals[], rootUrl: string): RankedPage[] {
  const ranked: RankedPage[] = signals.map((p) => {
    const { score, why } = scorePage(p, rootUrl);
    return { url: p.url, score, why, section: sectionOf(p.url) };
  });
  ranked.sort((a, b) => b.score - a.score);
  const groups = new Map<string, RankedPage[]>();
  for (const r of ranked) {
    if (r.score >= 1000) continue;
    const t = templateOf(r.url);
    if (!t) continue;
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t)!.push(r);
  }
  for (const [t, list] of groups) {
    if (list.length < GROUP_MIN) continue;
    list.forEach((r, i) => { r.group = t; if (i >= SAMPLES) r.similar = true; });
  }
  return [...ranked.filter((r) => !r.similar), ...ranked.filter((r) => r.similar)];
}
