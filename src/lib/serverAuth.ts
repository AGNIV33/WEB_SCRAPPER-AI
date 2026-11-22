/**
 * Server side: checks the Firebase ID token sent by the browser (Authorization: Bearer <token>)
 * using Google's public keys. No secret / service account needed.
 */
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

export type Caller = { uid: string; email?: string; emailVerified?: boolean; token: string } | null;

/** Returns the signed-in user, or null for guests (or if login isn't configured). */
export async function getCaller(req: Request): Promise<Caller> {
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token || !projectId) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${projectId}`, audience: projectId });
    return payload.sub ? { uid: payload.sub, email: payload.email as string | undefined, emailVerified: payload.email_verified === true, token } : null;
  } catch {
    return null;
  }
}

/**
 * Admin accounts: every feature, no plan limits, no rate limits. Set ADMIN_EMAILS (comma separated)
 * in .env.local and in Vercel. The email must be verified (Google sign-in always is), so nobody can
 * become admin by signing up with an admin address they do not own.
 */
// Forgiving parse: commas, semicolons or spaces between emails, and stray quotes are ignored
export const adminEmails = () => (process.env.ADMIN_EMAILS || "").split(/[,;\s]+/).map((e) => e.replace(/["'`]/g, "").trim().toLowerCase()).filter(Boolean);
export const isAdmin = (c: Caller) => !!c?.email && c.emailVerified === true && adminEmails().includes(c.email.toLowerCase());

/** True when login is set up for this deployment (otherwise everyone gets full access, as before). */
export const authConfigured = () => !!projectId && process.env.NEXT_PUBLIC_DISABLE_AUTH !== "1";

// ---- Plan limits (also shown in the UI) ----
export const LIMITS = {
  guestPages: 1,          // pages per analysis without an account
  freeSites: 10,          // unique websites per free account
  freeScansPerSite: 5,    // scans (first + retries) of the same website
};

type Usage = { sites: Record<string, number>; uniqueCount: number; total: number; plan?: string };

/** Reads the user's usage document with their own token (Firestore REST; rules allow owners to read). */
export async function readUsage(c: NonNullable<Caller>): Promise<Usage> {
  const empty: Usage = { sites: {}, uniqueCount: 0, total: 0 };
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${c.uid}/meta/usage`, { headers: { authorization: `Bearer ${c.token}` } });
    if (r.status === 404) return empty;
    if (!r.ok) return empty;
    const j = (await r.json()) as { fields?: Record<string, { integerValue?: string; stringValue?: string; mapValue?: { fields?: Record<string, { integerValue?: string }> } }> };
    const f = j.fields || {};
    const sites = Object.fromEntries(Object.entries(f.sites?.mapValue?.fields || {}).map(([k, v]) => [k, Number(v.integerValue || 0)]));
    return { sites, uniqueCount: Number(f.uniqueCount?.integerValue || 0), total: Number(f.total?.integerValue || 0), plan: f.plan?.stringValue };
  } catch {
    return empty;
  }
}

/** True if the admin removed this account (blocked/{uid} exists; owners may read their own block document). */
export async function isBlocked(c: NonNullable<Caller>): Promise<boolean> {
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/blocked/${c.uid}`, { headers: { authorization: `Bearer ${c.token}` } });
    return r.ok; // 200 = the block document exists, 404 = not blocked
  } catch {
    return false;
  }
}

/** Usage key for a website: hostname without "www." */
export const siteKey = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return url; } };

/** Can this account scan this site? Returns a reason when blocked. */
export function checkQuota(u: Usage, site: string): { ok: true } | { ok: false; reason: "sites" | "retries"; message: string } {
  if (u.plan === "pro" || u.plan === "admin") return { ok: true };
  const k = site.replace(/\./g, "_");
  const used = u.sites[k] || 0;
  if (used >= LIMITS.freeScansPerSite) return { ok: false, reason: "retries", message: `You have scanned this website ${used} times (free limit ${LIMITS.freeScansPerSite}).` };
  if (!used && u.uniqueCount >= LIMITS.freeSites) return { ok: false, reason: "sites", message: `You have used all ${LIMITS.freeSites} free websites.` };
  return { ok: true };
}
