import { rateLimit } from "@/lib/rateLimit";
import * as cheerio from "cheerio";
import { launchBrowser } from "@/lib/browser";
import { authConfigured, checkQuota, getCaller, isAdmin, isBlocked, LIMITS, readUsage, recordUsage, siteKey } from "@/lib/serverAuth";
import { hostKey, makePass, pageHash, readPass } from "@/lib/scanToken";
import { cleanPageUrl, isPublicUrl, normalizeUrl, readText, safeFetch, sameSite } from "@/lib/url";
import { rankPages, type PageSignals } from "@/lib/pagePriority";

export const maxDuration = 60;

/** Most pages the app will analyse in one run (each page = one headless-Chrome call). */
const MAX_ANALYZE = 50;
const MAX_ANALYZE_ADMIN = 200; // admin accounts: much bigger scans
/** How many URLs we try to find when counting the site. */
const COUNT_CAP = 500;

const key = (u: string) => {
  const x = new URL(u);
  x.hostname = x.hostname.replace(/^www\./, "");
  return x.toString().replace(/\/$/, "");
};

type SitemapEntry = { loc: string; priority?: number; lastmod?: string };

async function sitemapUrls(origin: string, cap: number): Promise<{ urls: SitemapEntry[]; truncated: boolean }> {
  const out: SitemapEntry[] = [];
  let truncated = false;
  const seen = new Set<string>();
  const tryOne = async (url: string, depth = 0) => {
    if (depth > 2 || seen.has(url) || seen.size > 12) return;
    seen.add(url);
    if (out.length >= cap) { truncated = true; return; }
    try {
      const { res } = await safeFetch(url, { timeoutMs: 8000 });
      if (!res.ok) return;
      const $ = cheerio.load(await readText(res, 5_000_000), { xml: true });
      const nested = $("sitemap > loc").map((_, e) => $(e).text().trim()).get();
      $("url").each((_, e) => {
        if (out.length >= cap) { truncated = true; return; }
        const loc = $(e).children("loc").first().text().trim();
        if (!loc) return;
        const pr = parseFloat($(e).children("priority").first().text());
        out.push({ loc, priority: isFinite(pr) ? Math.max(0, Math.min(1, pr)) : undefined, lastmod: $(e).children("lastmod").first().text().trim() || undefined });
      });
      for (const n of nested) {
        if (out.length >= cap || seen.size > 12) { truncated = true; break; }
        await tryOne(n, depth + 1);
      }
      if (nested.length && seen.size > 12) truncated = true;
    } catch { /* ignore */ }
  };
  // robots.txt may point to the sitemap
  const candidates = [origin + "/sitemap.xml", origin + "/sitemap_index.xml"];
  try {
    const { res } = await safeFetch(origin + "/robots.txt", { timeoutMs: 5000 });
    if (res.ok) (await readText(res, 200_000)).split("\n").forEach((l) => { const m = l.match(/^\s*sitemap:\s*(\S+)/i); if (m) candidates.unshift(m[1]); });
  } catch { /* ignore */ }
  for (const c of [...new Set(candidates)]) { if (out.length) break; await tryOne(c); }
  return { urls: out, truncated };
}

/** Breadth-first link discovery with a real browser (for sites rendered by JavaScript). */
async function renderedLinks(root: URL, found: Map<string, string>, deadline: number, note: (k: string, from: string, depth: number, nav: boolean, footer: boolean) => void) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", async (r) => {
      if (["image", "media", "font"].includes(r.resourceType())) return r.abort().catch(() => {});
      // Every request the browser makes (also redirects and page scripts) must go to a public address
      if (!(await isPublicUrl(r.url()))) return r.abort().catch(() => {});
      r.continue().catch(() => {});
    });
    const queue = [...found.values()];
    const level = new Map<string, number>(queue.map((u) => [key(u), 0]));
    const visited = new Set<string>();
    while (queue.length && found.size < COUNT_CAP && Date.now() < deadline && visited.size < 8) {
      const u = queue.shift()!;
      if (visited.has(key(u))) continue;
      visited.add(key(u));
      try {
        await page.goto(u, { waitUntil: "networkidle2", timeout: Math.max(5000, Math.min(20000, deadline - Date.now())) }).catch(() => null);
        const links = (await page.evaluate(`Array.from(document.querySelectorAll('a[href]')).map(a => [a.href, !!a.closest(${JSON.stringify(NAV_SEL)}), !!a.closest(${JSON.stringify(FOOTER_SEL)})])`)) as [string, boolean, boolean][];
        const d = (level.get(key(u)) ?? 0) + 1;
        for (const [h, nav, foot] of links) {
          const c = cleanPageUrl(h, u);
          if (!c || !sameSite(new URL(c), root)) continue;
          const k = key(c);
          if (!found.has(k) && found.size < COUNT_CAP) { found.set(k, c); queue.push(c); level.set(k, d); }
          if (found.has(k)) note(k, u, d, nav, foot);
        }
      } catch { /* skip page */ }
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Links inside these count as menu / footer links (used by the smart page priority). */
const NAV_SEL = "nav, header, [role=navigation], .menu, .nav, .navbar, #menu, #nav";
const FOOTER_SEL = "footer, [role=contentinfo], .footer, #footer";

/** Counts the scan (signed-in users) and returns the pass that /api/page needs. */
async function startScan(req: Request, token: unknown, chosen: unknown) {
  const p = readPass(token);
  if (!p || p.k !== "d") return Response.json({ error: "This scan has expired. Please start it again." }, { status: 400 });
  const caller = authConfigured() ? await getCaller(req) : null;
  if ((caller?.uid || "") !== p.u) return Response.json({ error: "Please sign in again and restart the scan." }, { status: 401 });
  const admin = isAdmin(caller);
  // The pages the user picked: real web links on this same website, no more than the plan allows
  const max = p.m ?? MAX_ANALYZE;
  const pages: string[] = [];
  const hashes = new Set<string>();
  for (const c of Array.isArray(chosen) ? chosen.slice(0, 1000) : []) {
    let u: URL;
    try { if (typeof c !== "string" || c.length > 2000) throw 0; u = normalizeUrl(c); } catch { return Response.json({ error: "One of the chosen pages is not a valid link." }, { status: 400 }); }
    if (hostKey(u.hostname) !== p.h) return Response.json({ error: "Only pages of this website can be scanned." }, { status: 400 });
    const h = pageHash(u.toString());
    if (!hashes.has(h)) { hashes.add(h); pages.push(u.toString()); }
  }
  if (!pages.length) return Response.json({ error: "Please pick at least one page." }, { status: 400 });
  if (pages.length > max) return Response.json({ error: `You can analyse up to ${max} pages in one scan. Please untick some pages.` }, { status: 400 });
  if (p.only && (pages.length !== 1 || pageHash(pages[0]) !== pageHash(p.only))) return Response.json({ error: "Without an account you can analyse the home page only. Sign in free to pick other pages." }, { status: 400 });
  if (caller && !admin) {
    if (await isBlocked(caller)) return Response.json({ error: "This account has been removed. Please contact support." }, { status: 403 });
    const q = checkQuota(await readUsage(caller), p.h);
    if (!q.ok) return Response.json({ error: q.message, paywall: q.reason }, { status: 402 });
    if (!(await recordUsage(caller, p.h))) return Response.json({ error: "Could not start the scan (usage could not be saved). Please try again." }, { status: 503 });
  }
  // Small sites (fewer pages found than the plan allows, e.g. JavaScript-only sites): when every found page is picked,
  // the browser may add pages it finds while scanning, up to the limit. Otherwise only the picked pages can be scanned.
  const open = !p.only && (p.f ?? 0) < max && pages.length >= (p.f ?? 0);
  return Response.json({ scanPass: makePass({ k: "s", h: p.h, u: p.u, only: p.only, p: admin || open ? undefined : [...hashes] }), pages, open, max });
}

/**
 * Finds the site's pages: crawls HTML links (breadth-first), then adds sitemap URLs.
 * Returns the pages ranked by smart priority (with near-duplicate groups) and the total found,
 * so the user can pick which pages to analyse.
 */
export async function POST(req: Request) {
  const limited = await rateLimit(req, "discover");
  if (limited) return limited;
  try {
    const body = await req.json();
    // Step 2 (after the user picked how many pages): check the limits again, count the scan, give the scan pass
    if (body.start) return await startScan(req, body.start, body.pages);
    const start = normalizeUrl(body.url);
    // Accounts: guests get 1 page; signed-in free users get 10 websites x 5 scans each
    const caller = authConfigured() ? await getCaller(req) : null;
    const guest = authConfigured() && !caller;
    const admin = isAdmin(caller);
    if (caller && !admin && (await isBlocked(caller))) return Response.json({ error: "This account has been removed. Please contact support." }, { status: 403 });
    if (caller && !admin) {
      const q = checkQuota(await readUsage(caller), siteKey(start.toString()));
      if (!q.ok) return Response.json({ error: q.message, paywall: q.reason }, { status: 402 });
    }
    const { res, finalUrl } = await safeFetch(start.toString());
    const root = new URL(finalUrl);
    const started = Date.now();

    const found = new Map<string, string>();
    found.set(key(root.toString()), root.toString());
    // What we learn about each page, for the smart page priority
    const sig = new Map<string, { depth?: number; from: Set<string>; nav: boolean; footer: boolean }>();
    const note = (k: string, from: string, depth: number, nav: boolean, footer: boolean) => {
      let s = sig.get(k);
      if (!s) sig.set(k, (s = { depth, from: new Set(), nav: false, footer: false }));
      if (s.depth === undefined || depth < s.depth) s.depth = depth;
      if (s.from.size < 1000) s.from.add(key(from));
      if (nav) s.nav = true;
      if (footer) s.footer = true;
    };
    sig.set(key(root.toString()), { depth: 0, from: new Set(), nav: false, footer: false });
    const queue: string[] = [root.toString()];
    const visited = new Set<string>();
    let firstHtml: string | null = res.ok ? await readText(res) : null;

    // Breadth-first over plain HTML (fast, no browser). Up to COUNT_CAP URLs or ~25 s.
    while (queue.length && found.size < COUNT_CAP && Date.now() - started < 25000) {
      const batch = queue.splice(0, 8).filter((u) => !visited.has(key(u)));
      await Promise.all(batch.map(async (u) => {
        visited.add(key(u));
        try {
          let html: string;
          if (firstHtml !== null && key(u) === key(root.toString())) { html = firstHtml; firstHtml = null; }
          else {
            const r = await safeFetch(u, { timeoutMs: 8000 });
            if (!(r.res.headers.get("content-type") || "").includes("html")) return;
            html = await readText(r.res);
          }
          const $ = cheerio.load(html);
          const d = (sig.get(key(u))?.depth ?? 0) + 1;
          $("a[href]").each((_, a) => {
            const c = cleanPageUrl($(a).attr("href") || "", u);
            if (!c || !sameSite(new URL(c), root)) return;
            const k = key(c);
            if (!found.has(k) && found.size < COUNT_CAP) { found.set(k, c); queue.push(c); }
            if (found.has(k) && k !== key(u)) note(k, u, d, $(a).closest(NAV_SEL).length > 0, $(a).closest(FOOTER_SEL).length > 0);
          });
        } catch { /* ignore page errors */ }
      }));
    }
    const crawlStopped = queue.length > 0;

    const sm = await sitemapUrls(root.origin, 2000);
    const smInfo = new Map<string, { priority?: number; lastmod?: string }>();
    for (const s of sm.urls) {
      const c = cleanPageUrl(s.loc, root.toString());
      if (!c || !sameSite(new URL(c), root)) continue;
      smInfo.set(key(c), s);
      if (found.size < COUNT_CAP && !found.has(key(c))) found.set(key(c), c);
    }
    // JavaScript-only sites (e.g. rockstargames.com) send an empty HTML shell with no links and no sitemap.
    // Then we open the pages in headless Chrome and read the links after the page has rendered.
    let rendered = false;
    if (found.size < 10) {
      rendered = true;
      const before = found.size;
      await renderedLinks(root, found, Date.now() + 40000, note).catch(() => {});
      if (found.size === before) rendered = false;
    }

    const total = Math.max(found.size, sm.urls.length);
    // Smart priority: home first, then menu / much-linked / shallow / key pages; near-duplicates grouped
    const signals: PageSignals[] = [...found].map(([k, url]) => {
      const s = sig.get(k);
      const m = smInfo.get(k);
      return { url, depth: s?.depth, inbound: s?.from.size ?? 0, nav: !!s?.nav, footer: !!s?.footer, smPriority: m?.priority, lastmod: m?.lastmod };
    });
    const ranked = rankPages(signals, root.toString());
    const maxAnalyze = guest ? LIMITS.guestPages : admin ? MAX_ANALYZE_ADMIN : MAX_ANALYZE;
    return Response.json({
      root: root.toString(),
      pages: ranked.map((r) => r.url),
      ranked,
      total,
      atLeast: crawlStopped || sm.truncated || found.size >= COUNT_CAP || rendered, // site may have even more pages
      sitemapCount: sm.urls.length,
      maxAnalyze,
      guest,
      startPass: makePass({ k: "d", h: hostKey(root.hostname), u: caller?.uid || "", only: guest ? root.toString() : undefined, m: maxAnalyze, f: found.size }, 3600),
      rendered, // true when links came from headless Chrome (JavaScript-only site)
      seconds: Math.round((Date.now() - started) / 100) / 10,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
