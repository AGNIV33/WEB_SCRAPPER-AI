import tls from "node:tls";
import { normalizeUrl, safeFetch, assertPublicHost } from "@/lib/url";

export const maxDuration = 30;

type Check = { name: string; ok: boolean; severity: "high" | "medium" | "low" | "info"; detail: string };

function certInfo(host: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const sock = tls.connect({ host, port: 443, servername: host, timeout: 8000, rejectUnauthorized: false }, () => {
      const c = sock.getPeerCertificate();
      const validTo = c.valid_to ? new Date(c.valid_to) : null;
      resolve({
        valid: sock.authorized,
        error: sock.authorizationError ? String(sock.authorizationError) : null,
        protocol: sock.getProtocol(),
        issuer: c.issuer?.O || c.issuer?.CN || null,
        subject: c.subject?.CN || null,
        validFrom: c.valid_from || null,
        validTo: c.valid_to || null,
        daysLeft: validTo ? Math.round((validTo.getTime() - Date.now()) / 86400000) : null,
        altNames: (c.subjectaltname || "").split(", ").slice(0, 10),
      });
      sock.end();
    });
    sock.on("error", (e) => resolve({ valid: false, error: e.message }));
    sock.on("timeout", () => { sock.destroy(); resolve({ valid: false, error: "timeout" }); });
  });
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    const u = normalizeUrl(url);
    await assertPublicHost(u);
    const { res, finalUrl, redirects } = await safeFetch(u.toString());
    const h = Object.fromEntries(res.headers.entries());
    const final = new URL(finalUrl);

    const checks: Check[] = [];
    const has = (k: string) => k in h;
    const csp = h["content-security-policy"] || "";
    checks.push({ name: "HTTPS", ok: final.protocol === "https:", severity: "high", detail: final.protocol === "https:" ? "Site is served over HTTPS" : "Site is served over plain HTTP" });
    checks.push({ name: "Strict-Transport-Security (HSTS)", ok: has("strict-transport-security"), severity: "medium", detail: h["strict-transport-security"] || "Missing: browsers may connect over HTTP first" });
    checks.push({ name: "Content-Security-Policy", ok: !!csp, severity: "medium", detail: csp ? csp.slice(0, 200) + (/unsafe-inline|unsafe-eval/.test(csp) ? " (uses unsafe-inline/unsafe-eval)" : "") : "Missing: weaker protection against XSS" });
    checks.push({ name: "Clickjacking protection", ok: has("x-frame-options") || /frame-ancestors/.test(csp), severity: "medium", detail: h["x-frame-options"] || (/frame-ancestors/.test(csp) ? "CSP frame-ancestors set" : "Missing X-Frame-Options / frame-ancestors") });
    checks.push({ name: "X-Content-Type-Options", ok: (h["x-content-type-options"] || "").toLowerCase() === "nosniff", severity: "low", detail: h["x-content-type-options"] || "Missing (should be nosniff)" });
    checks.push({ name: "Referrer-Policy", ok: has("referrer-policy"), severity: "low", detail: h["referrer-policy"] || "Missing (browser default applies)" });
    checks.push({ name: "Permissions-Policy", ok: has("permissions-policy"), severity: "low", detail: h["permissions-policy"]?.slice(0, 150) || "Missing" });
    checks.push({ name: "Cross-Origin-Opener-Policy", ok: has("cross-origin-opener-policy"), severity: "info", detail: h["cross-origin-opener-policy"] || "Missing" });
    const leaks = ["server", "x-powered-by", "x-aspnet-version", "x-aspnetmvc-version", "x-generator"].filter((k) => h[k] && /\d/.test(h[k]));
    checks.push({ name: "Version info leaked in headers", ok: leaks.length === 0, severity: "low", detail: leaks.length ? leaks.map((k) => `${k}: ${h[k]}`).join("; ") : "No version numbers exposed" });

    // HTTP -> HTTPS redirect
    let httpRedirect: boolean | null = null;
    try {
      const r = await safeFetch(`http://${final.host}/`, { timeoutMs: 6000 }, 3);
      httpRedirect = r.finalUrl.startsWith("https://");
    } catch { httpRedirect = null; }
    if (httpRedirect !== null) checks.push({ name: "HTTP redirects to HTTPS", ok: httpRedirect, severity: "medium", detail: httpRedirect ? "Yes" : "No: http:// version stays insecure" });

    const ssl = final.protocol === "https:" ? await certInfo(final.hostname) : null;
    if (ssl) {
      const days = ssl.daysLeft as number | null;
      checks.push({ name: "SSL certificate", ok: !!ssl.valid && (days ?? 0) > 14, severity: "high", detail: ssl.valid ? `Valid, issued by ${ssl.issuer}, ${days} days left (${ssl.protocol})` : `Problem: ${ssl.error}` });
      if (ssl.protocol && /TLSv1(\.1)?$/.test(String(ssl.protocol))) checks.push({ name: "TLS version", ok: false, severity: "high", detail: `Old protocol ${ssl.protocol}` });
    }

    const text = async (p: string) => {
      try { const r = await safeFetch(final.origin + p, { timeoutMs: 6000 }); return r.res.ok ? (await r.res.text()).slice(0, 4000) : null; } catch { return null; }
    };
    const [robots, securityTxt, sitemapHead] = await Promise.all([text("/robots.txt"), text("/.well-known/security.txt"), text("/sitemap.xml")]);
    checks.push({ name: "security.txt", ok: !!securityTxt && /contact:/i.test(securityTxt), severity: "info", detail: securityTxt ? "Present" : "Missing (/.well-known/security.txt)" });

    // Hosting / server hints from headers
    const hosting: string[] = [];
    if (h["cf-ray"]) hosting.push("Cloudflare");
    if (h["x-vercel-id"]) hosting.push("Vercel");
    if (h["x-nf-request-id"]) hosting.push("Netlify");
    if (h["x-amz-cf-id"]) hosting.push("AWS CloudFront");
    if (h["x-github-request-id"]) hosting.push("GitHub Pages");
    if (h["x-served-by"]?.includes("cache-")) hosting.push("Fastly");
    if (h["x-azure-ref"]) hosting.push("Azure Front Door");
    if (h["server"]) hosting.push(`Server: ${h["server"]}`);
    if (h["x-powered-by"]) hosting.push(`Powered by: ${h["x-powered-by"]}`);

    return Response.json({
      finalUrl, status: res.status, redirects, headers: h, checks, ssl, hosting,
      robots, hasSitemap: !!sitemapHead && /<(urlset|sitemapindex)/.test(sitemapHead), securityTxt: !!securityTxt,
      compression: h["content-encoding"] || null,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
