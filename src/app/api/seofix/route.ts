/**
 * SEO fix list with ready-to-paste code.
 * The issues and code are built from the measured data (always correct tags and URLs).
 * NVIDIA NIM (free) only writes better titles and meta descriptions; without AI, the current text is reused.
 */
import { gate } from "@/lib/gate";
import { chat, parseJson } from "@/lib/nim";
import type { SeoFix, SeoFixResult } from "@/lib/insights";

export const maxDuration = 90;

type P = {
  url: string; title?: string; description?: string | null; h1?: string[]; h2?: string[]; canonical?: string | null; lang?: string | null; viewport?: string | null;
  robots?: string | null; ogTitle?: string | null; ogDescription?: string | null; ogImage?: string | null; twitterCard?: string | null;
  images?: number; imagesNoAlt?: number; jsonLd?: string[]; wordCount?: number; text?: string;
};
type Body = { pages: P[]; hasSitemap?: boolean; hasRobots?: boolean; logo?: string | null };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cut = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");
const pathOf = (u: string) => { try { const x = new URL(u); return x.pathname + x.search || "/"; } catch { return u; } };

export async function POST(req: Request) {
  const g = await gate(req, "seofix", { needLogin: true });
  if (g.stop) return g.stop;
  let body: Body;
  try { body = (await req.json()) as Body; } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  const pages = (body.pages || []).filter((p) => p?.url).slice(0, 25);
  if (!pages.length) return Response.json({ fixes: [] } satisfies SeoFixResult);
  const home = pages[0];
  const origin = (() => { try { return new URL(home.url).origin; } catch { return ""; } })();
  const brand = (() => { const h = new URL(home.url).hostname.replace(/^www\./, "").split(".")[0]; return h.charAt(0).toUpperCase() + h.slice(1); })();
  const named = (home.ogTitle || home.title || "").split(/\s[|\-–—:]\s/)[0].trim();
  const siteName = cut(named.length >= 3 && !/^home(page)?$/i.test(named) ? named : brand, 60);

  // Pages whose title or description needs new text
  const titleCount: Record<string, number> = {};
  pages.forEach((p) => { if (p.title) titleCount[p.title] = (titleCount[p.title] || 0) + 1; });
  const titleBad = (p: P) => !p.title || p.title.length > 60 || p.title.length < 15 || titleCount[p.title] > 1;
  const descBad = (p: P) => !p.description || p.description.length > 160 || p.description.length < 50;
  const needText = pages.filter((p) => titleBad(p) || descBad(p)).slice(0, 12);

  // AI writes new titles + descriptions (one call). Falls back to trimmed existing text.
  let written: Record<string, { title?: string; description?: string }> = {};
  let ai = false, note: string | undefined;
  if (needText.length && process.env.NVIDIA_API_KEY) {
    const aiGate = await gate(req, "ai", { ai: true });
    if (aiGate.stop) note = "AI limit reached, so titles and descriptions reuse your current text.";
    else {
      try {
        const facts = needText.map((p) => ({ url: p.url, title: p.title, description: p.description, h1: p.h1?.slice(0, 2), h2: p.h2?.slice(0, 5), text: p.url === home.url ? (p.text || "").slice(0, 800) : undefined }));
        const out = await chat([
          { role: "system", content: "You are an SEO copywriter. Write accurate, specific text using only the facts given. Never invent prices, numbers or claims. Reply with JSON only." },
          { role: "user", content: `Site name: ${siteName}\nPages:\n${JSON.stringify(facts).slice(0, 9000)}\n\nFor EACH page write a unique SEO title (30-60 characters, main keyword first, may end with " | ${siteName}") and a unique meta description (120-155 characters, plain and clear, with a soft call to action). Return JSON: {"<page url>": {"title": "...", "description": "..."}}` },
        ], 1800, [50000, 30000]);
        written = parseJson<typeof written>(out) || {};
        ai = Object.keys(written).length > 0;
        if (!ai) note = "AI answer could not be read, so titles and descriptions reuse your current text.";
      } catch (e) { note = `AI skipped (${(e as Error).message.slice(0, 120)}). Titles and descriptions reuse your current text.`; }
    }
  } else if (needText.length) note = "Add NVIDIA_API_KEY so AI writes new titles and descriptions. For now they reuse your current text.";

  const fixes: SeoFix[] = [];
  const add = (f: SeoFix) => fixes.push(f);
  for (const p of pages) {
    const page = pathOf(p.url);
    const w = written[p.url] || {};
    const h1 = p.h1?.[0] || "";
    if (titleBad(p)) {
      const label = (h1 && h1 !== siteName ? h1 : "") || (p.title && p.title.length >= 15 && titleCount[p.title] === 1 ? p.title : "") || (p.url === home.url ? "Home" : pathOf(p.url).split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") || "Page");
      const t = w.title ? cut(w.title, 65) : cut(label.includes(siteName) ? label : `${label} | ${siteName}`, 60);
      const why = !p.title ? "Page has no <title>." : p.title.length > 60 ? `Title is ${p.title.length} characters; Google cuts it after ~60.` : p.title.length < 15 ? "Title is too short to describe the page." : "Same title is used on more than one page.";
      add({ page, issue: why, fix: w.title ? "Replace the title with this AI-written one." : "Use a unique title of 30-60 characters (edit the text below).", code: `<title>${esc(t)}</title>`, lang: "html", priority: !p.title ? "high" : "medium", ai: !!w.title });
    }
    if (descBad(p)) {
      const d = w.description ? cut(w.description, 160) : cut((p.description && p.description.length >= 50 ? p.description : "") || (p.ogDescription && p.ogDescription.length >= 50 ? p.ogDescription : "") || (p.text || "").slice(0, 300) || `${h1 || p.title || siteName} by ${siteName}. Learn more on our website.`, 155);
      const why = !p.description ? "No meta description, so Google picks random text." : p.description.length > 160 ? `Description is ${p.description.length} characters; aim for 120-155.` : "Description is too short.";
      add({ page, issue: why, fix: w.description ? "Put this AI-written description in the <head>." : "Put a 120-155 character description in the <head> (edit the text below).", code: `<meta name="description" content="${esc(d)}">`, lang: "html", priority: "medium", ai: !!w.description });
    }
    if (!p.h1?.length) add({ page, issue: "No H1 heading.", fix: "Give the page one main heading that says what it is about.", code: `<h1>${esc(cut(w.title || p.title || siteName, 70).split(/\s[|\-–—]\s/)[0])}</h1>`, lang: "html", priority: "high" });
    else if (p.h1.length > 1) add({ page, issue: `${p.h1.length} H1 headings.`, fix: "Keep one H1. Change the others to H2.", code: `<h1>${esc(p.h1[0])}</h1>\n${p.h1.slice(1, 4).map((x) => `<h2>${esc(cut(x, 80))}</h2>`).join("\n")}`, lang: "html", priority: "low" });
    if (!p.canonical) add({ page, issue: "No canonical link.", fix: "Tell Google the main address of this page (stops duplicate pages).", code: `<link rel="canonical" href="${esc(p.url.split("#")[0])}">`, lang: "html", priority: "low" });
    if (p.robots && /noindex/i.test(p.robots)) add({ page, issue: "Page is hidden from Google (noindex).", fix: "If this page should appear in Google, replace the robots tag.", code: `<meta name="robots" content="index, follow">`, lang: "html", priority: "high" });
    if (!p.ogTitle || !p.ogImage || !p.twitterCard) {
      const t = w.title || p.ogTitle || p.title || siteName, d = w.description || p.ogDescription || p.description || "";
      add({ page, issue: "Social share tags are missing or incomplete.", fix: "Add these so links look good on WhatsApp, LinkedIn, X and Facebook. Replace the image URL with a 1200×630 image.", code: [
        `<meta property="og:type" content="website">`, `<meta property="og:url" content="${esc(p.url)}">`, `<meta property="og:title" content="${esc(cut(t, 70))}">`,
        d ? `<meta property="og:description" content="${esc(cut(d, 160))}">` : "", `<meta property="og:image" content="${esc(p.ogImage || `${origin}/og-image.png`)}">`,
        `<meta name="twitter:card" content="summary_large_image">`].filter(Boolean).join("\n"), lang: "html", priority: "low" });
    }
    if ((p.imagesNoAlt || 0) > 0) add({ page, issue: `${p.imagesNoAlt} of ${p.images} images have no alt text.`, fix: "Add a short alt text that describes each image (use alt=\"\" only for decoration).", code: `<img src="photo.jpg" alt="Describe what the image shows">`, lang: "html", priority: "medium" });
    if (!p.lang) add({ page, issue: "No lang attribute on <html>.", fix: "Tell browsers and Google the page language (change en if needed).", code: `<html lang="en">`, lang: "html", priority: "low" });
    if (!p.viewport) add({ page, issue: "No viewport tag (page looks tiny on phones).", fix: "Add this inside <head>.", code: `<meta name="viewport" content="width=device-width, initial-scale=1">`, lang: "html", priority: "high" });
    if ((p.wordCount ?? 999) < 150 && p.url !== home.url) add({ page, issue: `Thin content (${p.wordCount} words).`, fix: "Add at least 300 helpful words: what it is, who it is for, and common questions.", code: "", lang: "txt", priority: "low" });
  }

  // Site-wide fixes
  if (!body.hasSitemap) add({ page: "/sitemap.xml", issue: "No sitemap.xml.", fix: "Save this as sitemap.xml in your site root, then submit it in Google Search Console.", lang: "xml", priority: "medium",
    code: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${esc(p.url.split("#")[0])}</loc></url>`).join("\n")}\n</urlset>` });
  if (!body.hasRobots) add({ page: "/robots.txt", issue: "No robots.txt.", fix: "Save this as robots.txt in your site root.", lang: "txt", priority: "low", code: `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml` });
  if (!home.jsonLd?.length) add({ page: pathOf(home.url), issue: "No structured data (JSON-LD).", fix: "Paste this in the home page <head> so Google knows your brand name and logo. Add your social profile links to sameAs.", lang: "html", priority: "low",
    code: `<script type="application/ld+json">\n${JSON.stringify({ "@context": "https://schema.org", "@graph": [{ "@type": "Organization", name: siteName, url: origin + "/", ...(body.logo && /^https?:/.test(body.logo) ? { logo: body.logo } : {}), sameAs: [] }, { "@type": "WebSite", name: siteName, url: origin + "/" }] }, null, 2)}\n</script>` });

  const rank = { high: 0, medium: 1, low: 2 };
  fixes.sort((a, b) => rank[a.priority] - rank[b.priority]);
  return Response.json({ ai, note, fixes: fixes.slice(0, 80) } satisfies SeoFixResult);
}
