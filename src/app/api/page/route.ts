import { rateLimit } from "@/lib/rateLimit";
import type { Page, HTTPRequest, HTTPResponse } from "puppeteer-core";
import { launchBrowser } from "@/lib/browser";
import { EXTRACT_SCRIPT } from "@/lib/extractScript";
import { assertPublicHost, isPublicUrl, normalizeUrl } from "@/lib/url";
import { authConfigured, getCaller, isAdmin } from "@/lib/serverAuth";
import { hostKey, readPass } from "@/lib/scanToken";
import { checkLibrary } from "@/lib/vulnDb";
import { fetchBestIcon, rankIcons } from "@/lib/favicon";

export const maxDuration = 60;

/** Rejects if a browser step hangs, so one slow page can't use up the whole function time. */
function within<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("This page is very heavy and took too long to respond. Try scanning it again on its own.")), Math.max(500, ms)))]);
}

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
  const { url, mobile, lite, pass } = await req.json(); // lite = backup mode for very heavy pages
  // Only pages of a scan that /api/discover started (plan limits checked + counted) can be scanned
  if (authConfigured()) {
    const p = readPass(pass);
    let target: URL | null = null;
    try { target = normalizeUrl(url); } catch { /* bad url */ }
    const caller = p?.u ? await getCaller(req) : null;
    const strip = (u: string) => u.replace(/^(https?:\/\/)www\./, "$1").replace(/\/$/, "");
    const ok = !!p && p.k === "s" && !!target && hostKey(target.hostname) === p.h
      && (!p.u || caller?.uid === p.u)
      && (!p.only || strip(target.toString()) === strip(p.only));
    if (!ok && !isAdmin(caller)) return Response.json({ url, error: "This scan has expired or is not allowed. Please start the scan again." }, { status: 403 });
  }
  let browser;
  let lastShot: string | null = null; // kept so even a failed page still returns its screenshot
  // Time budget: Vercel stops the function at 60 s, so slow steps are skipped when time runs short
  const started = Date.now();
  const left = () => 52_000 - (Date.now() - started);
  const timings: Record<string, number> = {};
  const mark = (k: string) => { timings[k] = Date.now() - started; };
  try {
    const target = normalizeUrl(url);
    await assertPublicHost(target);
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const requests: { url: string; type: string }[] = [];
    await page.setRequestInterception(true);
    page.on("request", (r: HTTPRequest) => {
      if (requests.length < 400) requests.push({ url: r.url(), type: r.resourceType() });
      // Backup mode: skip videos and audio, the usual reason a heavy page never finishes loading
      if (lite && r.resourceType() === "media") { r.abort().catch(() => {}); return; }
      // Every request the browser makes (page, redirects, scripts, images) must go to a public address
      isPublicUrl(r.url()).then((ok) => (ok ? r.continue() : r.abort())).catch(() => {});
    });
    const failed: string[] = [];
    page.on("requestfailed", (r) => { if (failed.length < 30) failed.push(r.url()); });

    // Every image / GIF / video the browser actually downloads (also carousel slides, lazy images,
    // hero videos and CSS images that the page HTML doesn't list directly).
    const netMedia = new Map<string, { mime: string; size: number }>();
    let mainResp: HTTPResponse | null = null; // main document response (kept even if the page never finishes loading)
    page.on("response", (res) => {
      try {
        if (res.request().isNavigationRequest() && res.frame() === page.mainFrame()) mainResp = res;
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
    // Wait for "load" rather than network idle: busy sites (trackers, chat widgets, video) never go idle.
    // Then give the network a few seconds to settle.
    const gotoResp = await page.goto(target.toString(), { waitUntil: lite ? "domcontentloaded" : "load", timeout: lite ? 20000 : 25000 }).catch(async (e) => {
      if (String(e).includes("timeout")) return null; // heavy page: carry on with what has loaded
      throw e;
    });
    const loadMs = Date.now() - t0;
    if (lite) await new Promise((r) => setTimeout(r, 2500)); // let the first screen render
    else await page.waitForNetworkIdle({ idleTime: 500, timeout: Math.max(1000, Math.min(6000, left() - 35000)) }).catch(() => {});
    const resp = gotoResp ?? (mainResp as HTTPResponse | null);
    mark("load");
    if (!lite && left() > 30000) await within(autoScroll(page), 6000).catch(() => {});
    await new Promise((r) => setTimeout(r, 400));

    // Screenshot FIRST, so every page that loads gets one even if data extraction fails later.
    // Full page (capped height); if that fails (huge/odd pages), fall back to the visible viewport.
    // A missing screenshot never fails the page: the data is still worth returning.
    let shot: string | null = null;
    try {
      if (lite) throw new Error("viewport only");
      const height = Math.min(((await within(page.evaluate("document.documentElement.scrollHeight"), 4000)) as number) || 800, 3600);
      shot = (await within(page.screenshot({ type: "jpeg", quality: 55, clip: { x: 0, y: 0, width: 1280, height: Math.max(height, 800) }, captureBeyondViewport: true, encoding: "base64" }), 12000)) as string;
    } catch {
      // heavy pages (WebGL, huge images) can stall a full-page capture: take the visible screen instead
      shot = (await within(page.screenshot({ type: "jpeg", quality: 60, encoding: "base64" }), 8000).catch(() => null)) as string | null;
    }
    lastShot = shot;
    mark("screenshot");

    type Extracted = Record<string, unknown> & {
      tech: { name: string; version: string | null }[];
      srcVersions: { name: string; version: string }[];
      links: { href: string; blank: boolean; rel: string }[];
      forms: { action: string; method: string; hasPassword: boolean }[];
    };
    let data: Extracted;
    try {
      data = (await within(page.evaluate(EXTRACT_SCRIPT), Math.max(8000, left() - 10000))) as Extracted;
    } catch (e) {
      if (String(e).includes("took too long")) throw new Error("This page is too heavy to read in time. Its screenshot was kept.");
      // page may have navigated (JS redirect); wait and try once more
      await new Promise((r) => setTimeout(r, 1500));
      data = (await within(page.evaluate(EXTRACT_SCRIPT), Math.max(6000, left() - 8000))) as Extracted;
    }
    mark("extract");

    // Core Web Vitals (lab measurement). INP needs a real user's clicks, so we report Total Blocking Time,
    // the lab metric Google uses as INP's stand-in in Lighthouse.
    const cwv = (await within(page.evaluate("window.__cwv || null"), 3000).catch(() => null)) as { lcp: number | null; cls: number; tbt: number; fcp: number | null } | null;
    const rate = (v: number | null, good: number, poor: number) => (v == null ? "n/a" : v <= good ? "good" : v <= poor ? "needs-improvement" : "poor");
    const vitals = cwv ? {
      lcp: cwv.lcp, cls: Math.round(cwv.cls * 1000) / 1000, tbt: Math.round(cwv.tbt), fcp: cwv.fcp,
      ratings: { lcp: rate(cwv.lcp, 2500, 4000), cls: rate(cwv.cls, 0.1, 0.25), tbt: rate(cwv.tbt, 200, 600), fcp: rate(cwv.fcp, 1800, 3000) },
    } : null;

    // Accessibility audit with axe-core (WCAG 2 A/AA rules), max ~15 s
    let a11y: { violations: { id: string; impact: string | null; help: string; description: string; helpUrl: string; count: number; targets: string[]; html?: string[]; why?: string[] }[]; passes: number } | null = null;
    if (!lite && left() > 22000) try {
      const axe = (await import("axe-core")).default;
      await within(page.evaluate(axe.source), 5000);
      const res = (await Promise.race([
        page.evaluate(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then(r => ({
          violations: r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, description: v.description, helpUrl: v.helpUrl, count: v.nodes.length, targets: v.nodes.slice(0, 3).map(n => String(n.target[0]).slice(0, 120)), html: v.nodes.slice(0, 3).map(n => String(n.html || '').slice(0, 300)), why: v.nodes.slice(0, 3).map(n => String(n.failureSummary || '').replace(/^Fix (any|all) of the following:\\s*/i, '').slice(0, 300)) })),
          passes: r.passes.length }))`),
        new Promise((r) => setTimeout(() => r(null), Math.min(15000, left() - 12000))),
      ])) as typeof a11y;
      a11y = res;
    } catch { a11y = null; }

    // Tablet + mobile screenshots for every page (first screen of each device)
    const deviceShot = async (w: number, h: number) => {
      try {
        await within(page.setViewport({ width: w, height: h, isMobile: true, deviceScaleFactor: 1, hasTouch: true }), 4000);
        await page.evaluate("window.scrollTo(0,0)");
        await new Promise((r) => setTimeout(r, 600));
        return (await within(page.screenshot({ type: "jpeg", quality: 60, encoding: "base64" }), 5000)) as string;
      } catch { return null; }
    };
    const tabletShot = !lite && left() > 9000 ? await deviceShot(768, 1024) : null;
    const mobileShot = !lite && left() > 6000 ? await deviceShot(390, 844) : null;

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

    mark("devices");
    const cookies = await within(page.cookies(), 3000).catch(() => []);

    // Fetch the favicon on the server and embed it, so it shows even when the site blocks hotlinking.
    let faviconData: string | null = null;
    if (mobile && left() > 4000) {
      const seo = (data as { seo?: { favicon?: string | null; icons?: { href: string; rel?: string; sizes?: string; type?: string }[] } }).seo;
      const links = seo?.icons?.length ? seo.icons : seo?.favicon ? [{ href: seo.favicon, rel: "icon" }] : [];
      faviconData = await within(fetchBestIcon(rankIcons(links, page.url()), 3500), 9000).catch(() => null);
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
      screenshot: shot ? "data:image/jpeg;base64," + shot : undefined,
      lite: !!lite,
      mobileScreenshot: mobileShot ? "data:image/jpeg;base64," + mobileShot : null,
      tabletScreenshot: tabletShot ? "data:image/jpeg;base64," + tabletShot : null,
      vitals, a11y, timings,
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
    if (browser) await within(browser.close(), 3000).catch(() => {});
  }
}
