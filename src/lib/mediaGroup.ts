/**
 * Merges duplicate media found while crawling, so each picture shows once in the Media section:
 * - the same file found on many pages,
 * - the same file with different size/format settings in the address (?w=800, ?$1600px$, Next.js /_next/image),
 * - size versions of one picture (…-desktop-01 / …-mobile-01, @2x, 800w, .webp / .jpg / .bin).
 * The biggest version is shown; the others are kept as `variants`.
 */
import type { MediaItem, PageResult } from "./report";

export type MediaGroup = MediaItem & { pages: string[]; variants: MediaItem[] };

// Address settings that only change size, quality or format (not which picture it is)
const SIZE_PARAM = /^(w|wid|width|h|hei|height|q|qlt|quality|fit|format|fm|fmt|auto|dpr|crop|resize|size|imwidth|imheight|scale|v|ver|version|cache|cb|t|ts|rev|bg|resmode|op_sharpen|sharpen)$/i;
// File-name words that only say which screen size/version this is
const VARIANT_WORD = /^(desktop|mobile|tablet|phone|small|medium|large|xlarge|xxl|xl|lg|md|sm|xs|thumb|thumbnail|retina|hd|sd|scaled|portrait|landscape|@?\d(\.\d)?x|\d{2,4}w|\d{2,4}px|\d{2,4}x\d{2,4})$/i;
const FAMILY = (t: MediaItem["type"]) => (t === "video" || t === "audio" ? t : "img");

/** Same key = same picture. */
export function groupKey(url: string, type: MediaItem["type"]): string {
  if (url.startsWith("data:")) return url;
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  const inner = u.searchParams.get("url"); // image-resizer addresses: /_next/image?url=/a.jpg&w=800
  if (inner && /\/(_next|_vercel)\/image|\/image\/?$|\/img\/?$/i.test(u.pathname)) {
    try { return groupKey(new URL(inner, u.origin).href, type); } catch { /* keep going */ }
  }
  const keep = [...u.searchParams.entries()].filter(([k]) => !SIZE_PARAM.test(k) && !k.startsWith("$")).sort(([a], [b]) => a.localeCompare(b));
  const parts = u.pathname.split("/");
  const file = parts.pop() || "";
  const stem = file.replace(/\.[a-z0-9]{2,5}$/i, "").split(/[-_.]+/).filter((w) => w && !VARIANT_WORD.test(w)).join("-").toLowerCase();
  return `${FAMILY(type)}|${u.hostname.replace(/^www\./, "")}${parts.join("/").toLowerCase()}/${stem}?${new URLSearchParams(keep)}`;
}

const area = (m: MediaItem) => (m.w || 0) * (m.h || 0);

export function groupMedia(pages: PageResult[]): MediaGroup[] {
  const groups = new Map<string, MediaGroup>();
  const order: string[] = [];
  for (const p of pages) for (const it of p.media || []) {
    const k = groupKey(it.url, it.type);
    const g = groups.get(k);
    if (!g) { groups.set(k, { ...it, pages: [p.url], variants: [it] }); order.push(k); continue; }
    if (!g.pages.includes(p.url)) g.pages.push(p.url);
    if (g.variants.some((v) => v.url === it.url)) continue;
    g.variants.push(it);
    // Show the biggest version; keep alt text / poster from any version
    const best = area(it) > area(g) || (!area(g) && /desktop|large|@2x/i.test(it.url)) ? it : g;
    const type = g.type === "image" || it.type === "image" ? (g.type === "gif" || it.type === "gif" ? "gif" : "image") : best.type;
    groups.set(k, { ...g, ...best, type, alt: g.alt || it.alt, poster: g.poster || it.poster, pages: g.pages, variants: g.variants });
  }
  return order.map((k) => groups.get(k)!);
}
