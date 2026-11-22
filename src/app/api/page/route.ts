import { rateLimit } from "@/lib/rateLimit";
import type { Page, HTTPRequest } from "puppeteer-core";
import { launchBrowser } from "@/lib/browser";
import { EXTRACT_SCRIPT } from "@/lib/extractScript";
import { assertPublicHost, normalizeUrl, safeFetch } from "@/lib/url";
import { checkLibrary } from "@/lib/vulnDb";

export const maxDuration = 60;

const PRIVATE_LITERAL = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|0\.0\.0\.0)/i;

async function autoScroll(page: Page) {
  await page.evaluate(`(async () => {
    const max = Math.min(document.body ? document.body.scrollHeight : 0, 6000);
    for (let y = 0; y < max; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
  })()`);
}

export async function POST(req: Request) {
  const limited = await rateLimit(req, "page");
  if (limited) return limited;
  const { url, mobile } = await req.json();
  let browser;
  let lastShot: string | null = null; // kept so even a failed page still returns its screenshot
  try {
    const target = normalizeUrl(url);
    await assertPublicHost(target);
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const requests: { url: string; type: string }[] = [];
    await page.setRequestInterception(true);
    page.on("request", (r: HTTPRequest) => {
      try {
        const h = new URL(r.url()).hostname;
        if (PRIVATE_LITERAL.test(h) && process.env.ALLOW_PRIVATE_HOSTS !== "1") return r.abort();
      } catch { /* data: urls etc */ }
      if (requests.length < 400) requests.push({ url: r.url(), type: r.resourceType() });
      r.continue();
    });
    const failed: string[] = [];
    page.on("requestfailed", (r) => { if (failed.length < 30) failed.push(r.url()); });

    // Every image / GIF / video the browser actually downloads (also carousel slides, lazy images,
    // hero videos and CSS images that the page HTML doesn't list directly).
    const netMedia = new Map<string, { mime: string; size: number }>();
    page.on("response", (res) => {
      try {
        const t = res.request().resourceType();
        if (t !== "image" && t !== "media") return;
        const url = res.url();
        if (url.startsWith("data:") || netMedia.size >= 300) return;
        const mime = (res.headers()["content-type"] || "").split(";")[0].trim();
        const size = Number(res.headers()["content-length"] || 0);
        netMedia.set(url.split("#")[0], { mime, size });
      } catch { /* ignore */ }
    });

    // Core Web Vitals (lab): observers start before the page's own code runs
    await page.evaluateOnNewDocument(`(() => {
      const v = (window.__cwv = { lcp: null, cls: 0, tbt: 0, fcp: null });
      try { new PerformanceObserver((l) => { const e = l.getEntries(); if (e.length) v.lcp = Math.round(e[e.length - 1].startTime); }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
      try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) v.cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); } catch {}
      try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { v.tbt += Math.max(0, e.duration - 50); })).observe({ type: 'longtask', buffered: true }); } catch {}
      try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.name === 'first-contentful-paint') v.fcp = Math.round(e.startTime); })).observe({ type: 'paint', buffered: true }); } catch {}
    })()`);

    const t0 = Date.now();
    const resp = await page.goto(target.toString(), { waitUntil: "networkidle2", timeout: 30000 }).catch(async (e) => {
      // fall back: page may never be "idle" (websockets, polling)
      if (String(e).includes("timeout")) return null;
      throw e;
    });
    const loadMs = Date.now() - t0;
    await autoScroll(page).catch(() => {});
    await new Promise((r) => setTimeout(r, 400));

    // Screenshot FIRST, so every page that loads gets one even if data extraction fails later.
    // Full page (capped height); if that fails (huge/odd pages), fall back to the visible viewport.
    let shot: string;
    try {
      const height = Math.min(((await page.evaluate("document.documentElement.scrollHeight")) as number) || 800, 3600);
      shot = (await page.screenshot({ type: "jpeg", quality: 55, clip: { x: 0, y: 0, width: 1280, height: Math.max(height, 800) }, captureBeyondViewport: true, encoding: "base64" })) as string;
    } catch {
      shot = (await page.screenshot({ type: "jpeg", quality: 60, encoding: "base64" })) as string;
    }
    lastShot = shot;

    type Extracted = Record<string, unknown> & {
      tech: { name: string; version: string | null }[];
      srcVersions: { name: string; version: string }[];
      links: { href: string; blank: boolean; rel: string }[];
      forms: { action: string; method: string; hasPassword: boolean }[];
    };
    let data: Extracted;
    try {
      data = (await page.evaluate(EXTRACT_SCRIPT)) as Extracted;
    } catch {
      // page may have navigated (JS redirect); wait and try once more
      await new Promise((r) => setTimeout(r, 1500));
      data = (await page.evaluate(EXTRACT_SCRIPT)) as Extracted;
    }

    // Core Web Vitals (lab measurement). INP needs a real user's clicks, so we report Total Blocking Time,
    // the lab metric Google uses as INP's stand-in in Lighthouse.
    const cwv = (await page.evaluate("window.__cwv || null").catch(() => null)) as { lcp: number | null; cls: number; tbt: number; fcp: number | null } | null;
    const rate = (v: number | null, good: number, poor: number) => (v == null ? "n/a" : v <= good ? "good" : v <= poor ? "needs-improvement" : "poor");
    const vitals = cwv ? {
      lcp: cwv.lcp, cls: Math.round(cwv.cls * 1000) / 1000, tbt: Math.round(cwv.tbt), fcp: cwv.fcp,
      ratings: { lcp: rate(cwv.lcp, 2500, 4000), cls: rate(cwv.cls, 0.1, 0.25), tbt: rate(cwv.tbt, 200, 600), fcp: rate(cwv.fcp, 1800, 3000) },
    } : null;

    // Accessibility audit with axe-core (WCAG 2 A/AA rules), max ~15 s
    let a11y: { violations: { id: string; impact: string | null; help: string; description: string; helpUrl: string; count: number; targets: string[] }[]; passes: number } | null = null;
    try {
      const axe = (await import("axe-core")).default;
      await page.evaluate(axe.source);
      const res = (await Promise.race([
        page.evaluate(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then(r => ({
          violations: r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, description: v.description, helpUrl: v.helpUrl, count: v.nodes.length, targets: v.nodes.slice(0, 3).map(n => String(n.target[0]).slice(0, 120)) })),
          passes: r.passes.length }))`),
        new Promise((r) => setTimeout(() => r(null), 15000)),
      ])) as typeof a11y;
      a11y = res;
    } catch { a11y = null; }

    // Tablet + mobile screenshots for every page (first screen of each device)
    const deviceShot = async (w: number, h: number) => {
      try {
        await page.setViewport({ width: w, height: h, isMobile: true, deviceScaleFactor: 1, hasTouch: true });
        await page.evaluate("window.scrollTo(0,0)");
        await new Promise((r) => setTimeout(r, 600));
        return (await page.screenshot({ type: "jpeg", quality: 60, encoding: "base64" })) as string;
      } catch { return null; }
    };
    const tabletShot = await deviceShot(768, 1024);
    const mobileShot = await deviceShot(390, 844);

    // Merge network media into the page's media list; label GIFs, videos and SVGs by their real file type
    {
      type M = { url: string; type: string; w?: number | null; h?: number | null; size?: number; mime?: string; source?: string };
      const list = ((data as unknown as { media?: M[] }).media || []) as M[];
      const byUrl = new Map(list.map((m) => [m.url, m]));
      for (const [url, info] of netMedia) {
        const isGif = info.mime === "image/gif" || /\.gif(\?|$)/i.test(url);
        const isVideo = info.mime.startsWith("video/") || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
        const isAudio = info.mime.startsWith("audio/");
        const isSvg = info.mime === "image/svg+xml" || /\.svg(\?|$)/i.test(url);
        const existing = byUrl.get(url);
        if (existing) {
          existing.size = info.size || existing.size; existing.mime = info.mime;
          if (isGif) existing.type = "gif";
          continue;
        }
        if (!isVideo && !isAudio && !isSvg && info.size > 0 && info.size < 1500) continue; // tracking pixels / spacers
        const m: M = { url, type: isVideo ? "video" : isAudio ? "audio" : isGif ? "gif" : isSvg ? "svg" : "image", size: info.size || undefined, mime: info.mime, source: "network" };
        list.push(m); byUrl.set(url, m);
      }
      for (const m of list) if (m.type === "image" && /\.gif(\?|$)/i.test(m.url)) m.type = "gif";
      (data as unknown as { media: M[] }).media = list.slice(0, 400);
    }

    const cookies = await page.cookies().catch(() => []);

    // Fetch the favicon on the server and embed it, so it shows even when the site blocks hotlinking.
    let faviconData: string | null = null;
    if (mobile) {
      const seo = (data as { seo?: { favicon?: string | null } }).seo;
      for (const src of [seo?.favicon, new URL("/favicon.ico", page.url()).toString()].filter(Boolean) as string[]) {
        try {
          if (src.startsWith("data:")) { faviconData = src; break; }
          const { res } = await safeFetch(src, { timeoutMs: 6000 });
          const type = res.headers.get("content-type") || "";
          const buf = Buffer.from(await res.arrayBuffer());
          if (res.ok && buf.length > 0 && buf.length < 200_000 && /image|icon|octet/.test(type)) {
            faviconData = `data:${type.split(";")[0] || "image/x-icon"};base64,${buf.toString("base64")}`;
            break;
          }
        } catch { /* try next */ }
      }
    }
    const finalUrl = page.url();
    const isHttps = finalUrl.startsWith("https://");
    const headers = resp ? resp.headers() : {};

    // ---- passive security checks for this page ----
    const mixed = isHttps ? requests.filter((r) => r.url.startsWith("http://")).map((r) => r.url).slice(0, 20) : [];
    const insecureForms = data.forms.filter((f) => f.action.startsWith("http://"));
    const pageHost = new URL(finalUrl).hostname;
    const thirdParty = [...new Set(requests.map((r) => { try { return new URL(r.url).hostname; } catch { return ""; } }).filter((h) => h && h !== pageHost && !h.endsWith("." + pageHost.replace(/^www\./, ""))))];
    const libIssues = [
      ...data.tech.map((t) => checkLibrary(t.name, t.version)),
      ...data.srcVersions.map((s) => checkLibrary(s.name === "angular" ? "angularjs" : s.name, s.version)),
    ].filter(Boolean);
    const uniqIssues = [...new Map(libIssues.map((i) => [i!.library + i!.version, i])).values()];

    return Response.json({
      url: target.toString(),
      finalUrl,
      status: resp ? resp.status() : null,
      loadMs,
      headers,
      screenshot: "data:image/jpeg;base64," + shot,
      mobileScreenshot: mobileShot ? "data:image/jpeg;base64," + mobileShot : null,
      tabletScreenshot: tabletShot ? "data:image/jpeg;base64," + tabletShot : null,
      vitals, a11y,
      faviconData,
      ...data,
      requestsByType: requests.reduce<Record<string, number>>((a, r) => ((a[r.type] = (a[r.type] || 0) + 1), a), {}),
      failedRequests: failed,
      security: {
        https: isHttps,
        mixedContent: mixed,
        insecureForms,
        passwordOnHttp: !isHttps && data.forms.some((f) => f.hasPassword),
        cookies: cookies.map((c) => ({ name: c.name, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite || "None/unset" })),
        thirdPartyDomains: thirdParty.slice(0, 40),
        blankNoopener: data.links.filter((l) => l.blank && !/noopener|noreferrer/.test(l.rel)).length,
        libIssues: uniqIssues,
      },
    });
  } catch (e) {
    return Response.json({ url, error: (e as Error).message, screenshot: lastShot ? "data:image/jpeg;base64," + lastShot : undefined }, { status: 200 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
