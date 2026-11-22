/**
 * Finds a website's logo icon (server side). Prefers high-quality icons (apple-touch-icon, SVG, large PNG) over the tiny
 * 16px favicon.ico, and returns it as a data: URL so it shows even when the site blocks hotlinking.
 */
import { safeFetch } from "./url";

export type IconLink = { href: string; rel?: string; sizes?: string; type?: string };

const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : "";
};

/** Reads <link rel="...icon..."> tags out of raw HTML. */
export function parseIconLinks(html: string, base: string): IconLink[] {
  const out: IconLink[] = [];
  for (const tag of html.slice(0, 300_000).match(/<link\b[^>]*>/gi) || []) {
    const rel = attr(tag, "rel").toLowerCase();
    if (!/icon/.test(rel)) continue;
    try { out.push({ href: new URL(attr(tag, "href"), base).toString(), rel, sizes: attr(tag, "sizes"), type: attr(tag, "type") }); } catch { /* bad href */ }
  }
  return out;
}

/** Candidate icon URLs, best first. */
export function rankIcons(links: IconLink[], base: string): string[] {
  const size = (s?: string) => Math.max(0, ...(s || "").split(/\s+/).map((x) => parseInt(x, 10) || 0));
  const scored = links.filter((l) => !!l.href).map((l) => {
    const isApple = /apple-touch/.test(l.rel || ""), isSvg = /svg/.test(l.type || "") || /\.svg(\?|$)/i.test(l.href);
    return { href: l.href, score: (isApple ? 100 : 0) + (isSvg ? 90 : 0) + Math.min(size(l.sizes), 512) / 4 + (/mask-icon/.test(l.rel || "") ? -50 : 0) };
  });
  const origin = (() => { try { return new URL(base).origin; } catch { return ""; } })();
  if (origin) scored.push({ href: `${origin}/apple-touch-icon.png`, score: 60 }, { href: `${origin}/favicon.ico`, score: 5 });
  const seen = new Set<string>();
  return scored.sort((a, b) => b.score - a.score).map((s) => s.href).filter((h) => (seen.has(h) ? false : (seen.add(h), true))).slice(0, 6);
}

/** Downloads the first candidate that really is an image. */
export async function fetchBestIcon(candidates: string[], timeoutMs = 4000): Promise<string | null> {
  for (const src of candidates) {
    try {
      if (src.startsWith("data:image")) return src.length < 300_000 ? src : null;
      const { res } = await safeFetch(src, { timeoutMs });
      const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const buf = Buffer.from(await res.arrayBuffer());
      const isImage = /^image\//.test(type) || /icon|octet-stream/.test(type) || /\.(ico|png|svg|jpe?g|webp)(\?|$)/i.test(src);
      if (res.ok && buf.length > 80 && buf.length < 300_000 && isImage && !/text\/html/.test(type)) {
        const mime = type.startsWith("image/") ? type : /\.svg/i.test(src) ? "image/svg+xml" : /\.png/i.test(src) ? "image/png" : "image/x-icon";
        return `data:${mime};base64,${buf.toString("base64")}`;
      }
    } catch { /* try the next one */ }
  }
  return null;
}
