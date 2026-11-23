/**
 * Signed scan passes. /api/discover gives one after it has checked the plan limits and counted the scan;
 * /api/page only scans pages with a valid pass. So nobody can skip the limits by calling /api/page directly.
 * Secret: SCAN_TOKEN_SECRET (any long random text). If missing, one is made from the other server keys.
 */
import crypto from "node:crypto";

/**
 * k: "d" = found pages (not started yet), "s" = scan started. h: website, u: user id ("" = guest), only: the one page a guest may scan.
 * m: most pages allowed in this scan, f: pages found (on "d" passes). p: hashes of the picked pages (on "s" passes; missing = any page of the site).
 */
export type ScanPass = { k: "d" | "s"; h: string; u: string; only?: string; m?: number; f?: number; p?: string[]; e: number };

/** Short fingerprint of a page link (ignores www and a trailing slash), stored in scan passes. */
export const pageHash = (u: string) =>
  crypto.createHash("sha256").update(u.replace(/^(https?:\/\/)www\./i, "$1").replace(/\/$/, "").toLowerCase()).digest("base64url").slice(0, 11);

const secret = () => {
  const s = process.env.SCAN_TOKEN_SECRET || [process.env.NVIDIA_API_KEY, process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY, process.env.UPSTASH_REDIS_REST_TOKEN, process.env.ADMIN_EMAILS].filter(Boolean).join("|");
  return crypto.createHash("sha256").update("scan-pass:" + (s || "local-dev-only")).digest();
};
const sign = (data: string) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");

export const hostKey = (host: string) => host.toLowerCase().replace(/^www\./, "");

export function makePass(p: Omit<ScanPass, "e">, ttlSec = 2 * 3600): string {
  const data = Buffer.from(JSON.stringify({ ...p, e: Math.floor(Date.now() / 1000) + ttlSec })).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function readPass(token: unknown): ScanPass | null {
  if (typeof token !== "string" || token.length > 4000) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const good = sign(data);
  if (good.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString()) as ScanPass;
    return p.e > Date.now() / 1000 ? p : null;
  } catch { return null; }
}
