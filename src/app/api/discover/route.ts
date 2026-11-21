import * as cheerio from "cheerio";
import { cleanPageUrl, normalizeUrl, safeFetch, sameSite } from "@/lib/url";

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

/**
 * Finds the site's pages: crawls HTML links (breadth-first, so main pages come first), then adds sitemap URLs.
 * Returns the ordered list and the total found, so the user can choose how many to analyse.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const start = normalizeUrl(body.url);
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
    const total = Math.max(found.size, sm.urls.length);
    return Response.json({
      root: root.toString(),
      pages: [...found.values()],
      total,
      atLeast: crawlStopped || sm.truncated || found.size >= COUNT_CAP, // site may have even more pages
      sitemapCount: sm.urls.length,
      maxAnalyze: MAX_ANALYZE,
      seconds: Math.round((Date.now() - started) / 100) / 10,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
