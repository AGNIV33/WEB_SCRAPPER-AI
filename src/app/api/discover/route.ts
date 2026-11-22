import { rateLimit } from "@/lib/rateLimit";
import * as cheerio from "cheerio";
import { launchBrowser } from "@/lib/browser";
import { authConfigured, checkQuota, getCaller, LIMITS, readUsage, siteKey } from "@/lib/serverAuth";
import { assertPublicHost, cleanPageUrl, normalizeUrl, safeFetch, sameSite } from "@/lib/url";

export const maxDuration = 60;

/** Most pages the app will analyse in one run (each page = one headless-Chrome call). */
const MAX_ANALYZE = 50;
/** How many URLs we try to find when counting the site. */
const COUNT_CAP = 500;

const key = (u: string) => {
  const x = new URL(u);
  x.hostname = x.hostname.replace(/^www\./, "");
  return x.toString().replace(/\/$/, "");
};

async function sitemapUrls(origin: string, cap: number): Promise<{ urls: string[]; truncated: boolean }> {
  const out: string[] = [];
  let truncated = false;
  const seen = new Set<string>();
  const tryOne = async (url: string, depth = 0) => {
    if (depth > 2 || seen.has(url) || seen.size > 12) return;
    seen.add(url);
    if (out.length >= cap) { truncated = true; return; }
    try {
      const { res } = await safeFetch(url, { timeoutMs: 8000 });
      if (!res.ok) return;
      const $ = cheerio.load(await res.text(), { xml: true });
      const nested = $("sitemap > loc").map((_, e) => $(e).text().trim()).get();
      $("url > loc").each((_, e) => { if (out.length < cap) out.push($(e).text().trim()); else truncated = true; });
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
    if (res.ok) (await res.text()).split("\n").forEach((l) => { const m = l.match(/^\s*sitemap:\s*(\S+)/i); if (m) candidates.unshift(m[1]); });
  } catch { /* ignore */ }
  for (const c of [...new Set(candidates)]) { if (out.length) break; await tryOne(c); }
  return { urls: out, truncated };
}

/** Breadth-first link discovery with a real browser (for sites rendered by JavaScript). */
async function renderedLinks(root: URL, found: Map<string, string>, deadline: number) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (r) => (["image", "media", "font"].includes(r.resourceType()) ? r.abort() : r.continue()));
    const queue = [...found.values()];
    const visited = new Set<string>();
    while (queue.length && found.size < COUNT_CAP && Date.now() < deadline && visited.size < 8) {
      const u = queue.shift()!;
      if (visited.has(key(u))) continue;
      visited.add(key(u));
      try {
        await assertPublicHost(new URL(u));
        await page.goto(u, { waitUntil: "networkidle2", timeout: Math.max(5000, Math.min(20000, deadline - Date.now())) }).catch(() => null);
        const hrefs = (await page.evaluate(`Array.from(document.querySelectorAll('a[href]')).map(a => a.href)`)) as string[];
        for (const h of hrefs) {
          const c = cleanPageUrl(h, u);
          if (!c || !sameSite(new URL(c), root)) continue;
          const k = key(c);
          if (!found.has(k) && found.size < COUNT_CAP) { found.set(k, c); queue.push(c); }
        }
      } catch { /* skip page */ }
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Finds the site's pages: crawls HTML links (breadth-first, so main pages come first), then adds sitemap URLs.
 * Returns the ordered list and the total found, so the user can choose how many to analyse.
 */
export async function POST(req: Request) {
  const limited = await rateLimit(req, "discover");
  if (limited) return limited;
  try {
    const body = await req.json();
    const start = normalizeUrl(body.url);
    // Accounts: guests get 1 page; signed-in free users get 10 websites x 5 scans each
    const caller = authConfigured() ? await getCaller(req) : null;
    const guest = authConfigured() && !caller;
    if (caller) {
      const q = checkQuota(await readUsage(caller), siteKey(start.toString()));
      if (!q.ok) return Response.json({ error: q.message, paywall: q.reason }, { status: 402 });
    }
    const { res, finalUrl } = await safeFetch(start.toString());
    const root = new URL(finalUrl);
    const started = Date.now();

    const found = new Map<string, string>();
    found.set(key(root.toString()), root.toString());
    const queue: string[] = [root.toString()];
    const visited = new Set<string>();
    let firstHtml: string | null = res.ok ? await res.text() : null;

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
            html = await r.res.text();
          }
          const $ = cheerio.load(html);
          $("a[href]").each((_, a) => {
            const c = cleanPageUrl($(a).attr("href") || "", u);
            if (!c || !sameSite(new URL(c), root)) return;
            const k = key(c);
            if (!found.has(k) && found.size < COUNT_CAP) { found.set(k, c); queue.push(c); }
          });
        } catch { /* ignore page errors */ }
      }));
    }
    const crawlStopped = queue.length > 0;

    const sm = await sitemapUrls(root.origin, 2000);
    for (const s of sm.urls) {
      if (found.size >= COUNT_CAP) break;
      const c = cleanPageUrl(s, root.toString());
      if (c && sameSite(new URL(c), root) && !found.has(key(c))) found.set(key(c), c);
    }
    // JavaScript-only sites (e.g. rockstargames.com) send an empty HTML shell with no links and no sitemap.
    // Then we open the pages in headless Chrome and read the links after the page has rendered.
    let rendered = false;
    if (found.size < 10) {
      rendered = true;
      const before = found.size;
      await renderedLinks(root, found, Date.now() + 40000).catch(() => {});
      if (found.size === before) rendered = false;
    }

    const total = Math.max(found.size, sm.urls.length);
    return Response.json({
      root: root.toString(),
      pages: [...found.values()],
      total,
      atLeast: crawlStopped || sm.truncated || found.size >= COUNT_CAP || rendered, // site may have even more pages
      sitemapCount: sm.urls.length,
      maxAnalyze: guest ? LIMITS.guestPages : MAX_ANALYZE,
      guest,
      rendered, // true when links came from headless Chrome (JavaScript-only site)
      seconds: Math.round((Date.now() - started) / 100) / 10,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
