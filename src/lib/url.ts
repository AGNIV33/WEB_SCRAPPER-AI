import dns from "node:dns/promises";
import net from "node:net";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 SiteAnalyzer/1.0";

export function normalizeUrl(input: string): URL {
  let s = (input || "").trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  const u = new URL(s);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http/https URLs are allowed");
  u.hash = "";
  return u;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

/** Blocks localhost / private network targets so the deployed app can't be used to probe internal networks. */
export async function assertPublicHost(u: URL) {
  if (process.env.ALLOW_PRIVATE_HOSTS === "1") return;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("Private/local addresses are not allowed");
  }
  const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((r) => r.address);
  if (ips.some(isPrivateIp)) throw new Error("Private/local addresses are not allowed");
}

/** fetch with timeout + safe redirect handling (each hop checked). */
export async function safeFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  maxRedirects = 5
): Promise<{ res: Response; finalUrl: string; redirects: string[] }> {
  let current = url;
  const redirects: string[] = [];
  for (let i = 0; i <= maxRedirects; i++) {
    const u = new URL(current);
    await assertPublicHost(u);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 12000);
    try {
      const res = await fetch(current, {
        ...init,
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": UA, accept: "*/*", ...(init.headers || {}) },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        redirects.push(current);
        current = new URL(res.headers.get("location")!, current).toString();
        continue;
      }
      return { res, finalUrl: current, redirects };
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error("Too many redirects");
}

export function sameSite(a: URL, b: URL) {
  const strip = (h: string) => h.replace(/^www\./, "");
  return strip(a.hostname) === strip(b.hostname);
}

export function cleanPageUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    u.hash = "";
    // skip obvious files
    if (/\.(pdf|jpe?g|png|gif|svg|webp|avif|ico|zip|rar|gz|mp4|mp3|webm|mov|css|js|json|xml|txt|woff2?|ttf|eot|docx?|xlsx?|pptx?)$/i.test(u.pathname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}
