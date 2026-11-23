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

/** Ports the scanner may connect to. Blocks odd ports (e.g. the server's own internal services). */
const OK_PORTS = new Set(["", "80", "443", "8080", "8443"]);

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b, c] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (!net.isIPv6(v)) return true; // unknown format: treat as unsafe
  // IPv4 inside IPv6: ::ffff:1.2.3.4, ::ffff:7f00:1 (hex form), NAT64 64:ff9b::, 6to4 2002::
  const tail = v.match(/^(?:::ffff:|::|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) return isPrivateIp(tail[1]);
  const hex = v.match(/^(?:::ffff:|::|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) { const n1 = parseInt(hex[1], 16), n2 = parseInt(hex[2], 16); return isPrivateIp(`${n1 >> 8}.${n1 & 255}.${n2 >> 8}.${n2 & 255}`); }
  const six = v.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4}):/);
  if (six) { const n1 = parseInt(six[1], 16), n2 = parseInt(six[2], 16); return isPrivateIp(`${n1 >> 8}.${n1 & 255}.${n2 >> 8}.${n2 & 255}`); }
  return v === "::1" || v === "::" || /^f[c-f]/.test(v) || v.startsWith("ff");
}

/** Blocks localhost / private network targets so the deployed app can't be used to probe internal networks. */
export async function assertPublicHost(u: URL) {
  if (process.env.ALLOW_PRIVATE_HOSTS === "1") return;
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http/https URLs are allowed");
  if (!OK_PORTS.has(u.port)) throw new Error("Only standard web ports (80, 443, 8080, 8443) are allowed");
  if (u.username || u.password) throw new Error("URLs with a username or password are not allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new Error("Private/local addresses are not allowed");
  }
  const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(isPrivateIp)) throw new Error("Private/local addresses are not allowed");
}

/** Cached yes/no check for the headless browser's own requests (each sub-request is checked, also after redirects). */
const hostCache = new Map<string, { ok: boolean; at: number }>();
export async function isPublicUrl(raw: string): Promise<boolean> {
  if (process.env.ALLOW_PRIVATE_HOSTS === "1") return true;
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol === "data:" || u.protocol === "blob:" || u.protocol === "about:") return true; // no network
  const k = `${u.protocol}//${u.host}`;
  const hit = hostCache.get(k);
  if (hit && Date.now() - hit.at < 60_000) return hit.ok;
  let ok = true;
  try { await assertPublicHost(u); } catch { ok = false; }
  if (hostCache.size > 2000) hostCache.clear();
  hostCache.set(k, { ok, at: Date.now() });
  return ok;
}

/** Reads a response body as text, stopping at maxBytes (protects server memory from huge pages). */
export async function readText(res: Response, maxBytes = 3_000_000): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    if (total >= maxBytes) { reader.cancel().catch(() => {}); break; }
  }
  return Buffer.concat(chunks).toString("utf8");
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
