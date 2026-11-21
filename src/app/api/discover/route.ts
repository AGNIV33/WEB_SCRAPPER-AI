import * as cheerio from "cheerio";
import { cleanPageUrl, normalizeUrl, safeFetch, sameSite } from "@/lib/url";

export const maxDuration = 60;

const key = (u: string) => {
  const x = new URL(u);
  x.hostname = x.hostname.replace(/^www\./, "");
  return x.toString().replace(/\/$/, "");
};

async function sitemapUrls(origin: string): Promise<string[]> {
  const out: string[] = [];
  const tryOne = async (url: string, depth = 0) => {
    if (depth > 1 || out.length > 500) return;
    try {
      const { res } = await safeFetch(url, { timeoutMs: 8000 });
      if (!res.ok) return;
      const xml = await res.text();
      const $ = cheerio.load(xml, { xml: true });
      const nested = $("sitemap > loc").map((_, e) => $(e).text().trim()).get();
      for (const n of nested.slice(0, 3)) await tryOne(n, depth + 1);
      $("url > loc").each((_, e) => { out.push($(e).text().trim()); });
    } catch { /* ignore */ }
  };
  await tryOne(origin + "/sitemap.xml");
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const limit = Math.max(1, Math.min(50, Number(body.limit) || 10));
    const start = normalizeUrl(body.url);
    const { res, finalUrl } = await safeFetch(start.toString());
    const root = new URL(finalUrl);
    const started = Date.now();

    const found = new Map<string, string>(); // key -> url
    found.set(key(root.toString()), root.toString());
    const queue: string[] = [root.toString()];
    const visited = new Set<string>();
    let firstHtml: string | null = res.ok ? await res.text() : null;

    // BFS over plain HTML (fast, no browser). Stops at limit or ~35s.
    while (queue.length && found.size < limit && Date.now() - started < 35000) {
      const batch = queue.splice(0, 5).filter((u) => !visited.has(key(u)));
      await Promise.all(
        batch.map(async (u) => {
          visited.add(key(u));
          try {
            let html: string;
            if (firstHtml !== null && key(u) === key(root.toString())) {
              html = firstHtml;
              firstHtml = null;
            } else {
              const r = await safeFetch(u, { timeoutMs: 10000 });
              if (!(r.res.headers.get("content-type") || "").includes("html")) return;
              html = await r.res.text();
            }
            const $ = cheerio.load(html);
            $("a[href]").each((_, a) => {
              const c = cleanPageUrl($(a).attr("href") || "", u);
              if (!c || !sameSite(new URL(c), root)) return;
              const k = key(c);
              if (!found.has(k) && found.size < limit) {
                found.set(k, c);
                queue.push(c);
              }
            });
          } catch { /* ignore page errors */ }
        })
      );
    }

    // Top up from sitemap if the HTML links were not enough (e.g. JS-rendered sites)
    let sitemapCount = 0;
    const sm = found.size < limit ? await sitemapUrls(root.origin) : [];
    sitemapCount = sm.length;
    for (const s of sm) {
      if (found.size >= limit) break;
      const c = cleanPageUrl(s, root.toString());
      if (c && sameSite(new URL(c), root) && !found.has(key(c))) found.set(key(c), c);
    }

    return Response.json({ root: root.toString(), pages: [...found.values()].slice(0, limit), sitemapCount });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
