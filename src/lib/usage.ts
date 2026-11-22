"use client";
/* Free-plan usage for signed-in users: 10 unique websites, 5 scans per website.
 * Stored at users/{uid}/meta/usage. Firestore rules only allow counts to go up. */
import { doc, getDoc, runTransaction } from "firebase/firestore";
import { auth, db } from "./firebase";

export const LIMITS = { guestPages: 1, freeSites: 10, freeScansPerSite: 5 };
export type Usage = { sites: Record<string, number>; uniqueCount: number; total: number; plan?: string };

export const siteKey = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase().replace(/\./g, "_"); } catch { return url; } };
const ref = () => { const uid = auth?.currentUser?.uid; if (!db || !uid) return null; return doc(db, "users", uid, "meta", "usage"); };

export async function getUsage(): Promise<Usage> {
  const r = ref();
  const empty: Usage = { sites: {}, uniqueCount: 0, total: 0 };
  if (!r) return empty;
  try { const s = await getDoc(r); return s.exists() ? ({ ...empty, ...s.data() } as Usage) : empty; } catch { return empty; }
}

/** Counts one successful scan of a website. */
export async function recordScan(url: string) {
  const r = ref();
  if (!r || !db) return;
  const k = siteKey(url);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(r);
    const u: Usage = s.exists() ? (s.data() as Usage) : { sites: {}, uniqueCount: 0, total: 0 };
    const sites = { ...(u.sites || {}) };
    const isNew = !sites[k];
    sites[k] = (sites[k] || 0) + 1;
    tx.set(r, { sites, uniqueCount: (u.uniqueCount || 0) + (isNew ? 1 : 0), total: (u.total || 0) + 1 }, { merge: true });
  });
}

/** Local check before starting (the server checks again). */
export function quotaFor(u: Usage, url: string) {
  const used = u.sites?.[siteKey(url)] || 0;
  return {
    used, sitesLeft: Math.max(0, LIMITS.freeSites - (u.uniqueCount || 0)), scansLeft: Math.max(0, LIMITS.freeScansPerSite - used),
    blocked: u.plan === "pro" ? null : used >= LIMITS.freeScansPerSite ? "retries" : !used && (u.uniqueCount || 0) >= LIMITS.freeSites ? "sites" : null,
  };
}
