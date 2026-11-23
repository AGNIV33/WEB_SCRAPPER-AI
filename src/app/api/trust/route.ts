/**
 * Trust / scam check. All free:
 * - SSL certificate (direct TLS handshake)
 * - Domain age, expiry and registrar from RDAP (the official replacement for WHOIS, no key)
 * - Google Safe Browsing (needs GOOGLE_API_KEY with the Safe Browsing API turned on; skipped without it)
 * - Signals from the crawl: privacy policy, terms, contact and about pages
 */
import { gate } from "@/lib/gate";
import { certInfo } from "@/lib/cert";
import { assertPublicHost, normalizeUrl } from "@/lib/url";
import type { TrustCheck, TrustResult } from "@/lib/insights";

export const maxDuration = 30;

// Common two-part endings (co.uk, com.au …) so we look up the real registered domain
const SECOND_LEVEL = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "com.au", "net.au", "org.au", "co.in", "net.in", "org.in", "firm.in", "gen.in", "ind.in", "co.jp", "ne.jp", "or.jp", "co.nz", "org.nz", "co.za", "com.br", "com.mx", "com.ar", "com.cn", "com.hk", "com.sg", "com.my", "com.tr", "com.pk", "com.bd", "com.ng", "co.kr", "co.id", "co.th", "com.ph", "com.vn", "com.tw", "com.eg", "com.sa", "co.il", "com.ua"]);
function registrable(host: string) {
  const p = host.toLowerCase().replace(/\.$/, "").split(".");
  if (p.length <= 2) return p.join(".");
  const last2 = p.slice(-2).join(".");
  return SECOND_LEVEL.has(last2) ? p.slice(-3).join(".") : last2;
}

type Rdap = { events?: { eventAction: string; eventDate: string }[]; entities?: { roles?: string[]; vcardArray?: [string, [string, unknown, string, string][]] }[] };
async function rdap(domain: string): Promise<TrustResult["domainInfo"]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { signal: ctrl.signal, headers: { accept: "application/rdap+json, application/json" }, redirect: "follow" });
    if (!r.ok) return null;
    const j = (await r.json()) as Rdap;
    const ev = (a: string) => j.events?.find((e) => e.eventAction === a)?.eventDate || null;
    const created = ev("registration");
    const reg = j.entities?.find((e) => e.roles?.includes("registrar"));
    const registrar = (reg?.vcardArray?.[1]?.find((x) => x[0] === "fn")?.[3] as string) || null;
    return { created, expires: ev("expiration"), registrar, ageDays: created ? Math.floor((Date.now() - new Date(created).getTime()) / 86400000) : null };
  } catch { return null; } finally { clearTimeout(t); }
}

async function safeBrowsing(urls: string[]): Promise<{ listed: boolean; types: string[] } | null> {
  const key = process.env.SAFE_BROWSING_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "site-analyzer", clientVersion: "1.0" },
        threatInfo: { threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"], platformTypes: ["ANY_PLATFORM"], threatEntryTypes: ["URL"], threatEntries: urls.map((url) => ({ url })) },
      }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { matches?: { threatType: string }[] };
    const types = [...new Set((j.matches || []).map((m) => m.threatType))];
    return { listed: types.length > 0, types };
  } catch { return null; }
}

const fmtDate = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "unknown");
const age = (days: number) => (days >= 730 ? `${Math.floor(days / 365)} years` : days >= 60 ? `${Math.floor(days / 30)} months` : `${days} days`);

export async function POST(req: Request) {
  const g = await gate(req, "trust", { needLogin: true });
  if (g.stop) return g.stop;
  try {
    const { url, signals = {} } = (await req.json()) as { url: string; signals?: { privacy?: boolean; terms?: boolean; contact?: boolean; about?: boolean; passwordOnHttp?: boolean } };
    const u = normalizeUrl(url);
    await assertPublicHost(u);
    const domain = registrable(u.hostname);
    const [cert, info, sb] = await Promise.all([
      u.protocol === "https:" ? certInfo(u.hostname) : Promise.resolve(null),
      rdap(domain),
      safeBrowsing([u.toString(), `${u.origin}/`]),
    ]);

    const checks: TrustCheck[] = [];
    // Google Safe Browsing
    checks.push(sb === null
      ? { name: "Google Safe Browsing", ok: null, weight: "high", detail: "Not checked (add GOOGLE_API_KEY with the Safe Browsing API turned on)." }
      : { name: "Google Safe Browsing", ok: !sb.listed, weight: "high", detail: sb.listed ? `Listed by Google as: ${sb.types.join(", ").toLowerCase().replace(/_/g, " ")}` : "Not on Google's list of unsafe sites." });
    // HTTPS + certificate
    checks.push({ name: "HTTPS", ok: u.protocol === "https:", weight: "high", detail: u.protocol === "https:" ? "Connection is encrypted." : "Site does not use HTTPS." });
    if (cert) {
      const days = cert.daysLeft as number | null;
      checks.push({ name: "SSL certificate", ok: !!cert.valid, weight: "high", detail: cert.valid ? `Valid, issued by ${cert.issuer}${days !== null ? `, ${days} days left` : ""}.` : `Problem: ${cert.error}` });
    }
    // Domain age (new domains are a common scam sign)
    if (info?.ageDays != null) {
      const d = info.ageDays;
      checks.push({ name: "Domain age", ok: d >= 365, weight: d < 30 ? "high" : d < 180 ? "medium" : "low", detail: `${domain} was registered ${age(d)} ago (${fmtDate(info.created)}).${d < 180 ? " Very new domains are often used by scam sites." : ""}` });
    } else checks.push({ name: "Domain age", ok: null, weight: "medium", detail: `Not public for ${domain} (some country domains hide it).` });
    if (info?.expires) {
      const left = Math.floor((new Date(info.expires).getTime() - Date.now()) / 86400000);
      checks.push({ name: "Domain renewal", ok: left > 60, weight: "low", detail: `Paid until ${fmtDate(info.expires)} (${left} days).${left <= 60 ? " Short registrations are a mild warning sign." : ""}` });
    }
    // From the crawl
    const sig = (k: keyof typeof signals, name: string, weight: TrustCheck["weight"], yes: string, no: string) => checks.push({ name, ok: !!signals[k], weight, detail: signals[k] ? yes : no });
    sig("contact", "Contact page", "medium", "Found a contact page or contact details.", "No contact page found in the scanned pages.");
    sig("privacy", "Privacy policy", "low", "Found a privacy policy.", "No privacy policy link found.");
    sig("terms", "Terms / refund policy", "low", "Found terms or a refund/return policy.", "No terms or refund policy link found.");
    sig("about", "About page", "low", "Found an about page.", "No about page found.");
    if (signals.passwordOnHttp) checks.push({ name: "Password form on HTTP", ok: false, weight: "high", detail: "A login form sends passwords without encryption." });

    const minus = { high: 30, medium: 15, low: 5 };
    let score = Math.max(0, 100 - checks.filter((c) => c.ok === false).reduce((s, c) => s + minus[c.weight], 0));
    if (sb?.listed) score = Math.min(score, 5);
    const verdict: TrustResult["verdict"] = sb?.listed || score < 45 ? "risky" : score < 75 ? "caution" : "safe";
    return Response.json({ score, verdict, domain, checks, domainInfo: info } satisfies TrustResult);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
