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

    let mobileShot: string | null = null;
    if (mobile) {
      await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 1, hasTouch: true });
      await new Promise((r) => setTimeout(r, 500));
      mobileShot = (await page.screenshot({ type: "jpeg", quality: 60, encoding: "base64" })) as string;
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
