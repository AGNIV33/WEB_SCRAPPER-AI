"use client";
/* Public read-only report links: shares/{id} in Firestore (anyone can read, only the owner can create/delete). */
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { PageResult, SiteResult, Summary } from "./report";
import type { AiResult } from "@/components/Dashboard";

const MAX = 950_000;

function pack(pages: PageResult[], level: number) {
  return pages.map((p, i) => {
    const x: PageResult = { ...p, screenshot: undefined, mobileScreenshot: undefined, tabletScreenshot: undefined, textSample: undefined, failedRequests: undefined };
    x.media = (p.media || []).filter((m) => !m.url.startsWith("data:")).slice(0, level ? 30 : 120);
    if (level >= 1) x.links = (p.links || []).slice(0, 40);
    if (level >= 2 && i > 0) { x.design = undefined; x.cssVars = undefined; x.links = []; x.a11y = undefined; }
    return x;
  });
}

export async function createShare(d: { pages: PageResult[]; site: SiteResult | null; summary: Summary; ai: AiResult | null; meta: { startedAt: Date; seconds: number } | null }) {
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) throw new Error("Sign in to create a share link");
  const host = (() => { try { return new URL(d.summary.url || d.pages[0].url).hostname; } catch { return ""; } })();
  const base = {
    ownerUid: uid, created_at: serverTimestamp(), host, url: d.summary.url || "",
    analyzedAt: (d.meta?.startedAt || new Date()).toISOString(), seconds: d.meta?.seconds || 0,
    favicon: d.pages.find((p) => p.faviconData)?.faviconData?.slice(0, 60_000) || null,
    summaryJson: JSON.stringify(d.summary), aiJson: JSON.stringify(d.ai), siteJson: JSON.stringify(d.site),
  };
  let pagesJson = "";
  for (let level = 0; level <= 2; level++) {
    pagesJson = JSON.stringify(pack(d.pages, level));
    if (pagesJson.length + base.summaryJson.length + base.aiJson.length + base.siteJson.length < MAX) break;
  }
  const ref = await addDoc(collection(db, "shares"), { ...base, pagesJson });
  return `${location.origin}/share/${ref.id}`;
}

export async function loadShare(id: string) {
  if (!db) throw new Error("Sharing is not configured");
  const s = await getDoc(doc(db, "shares", id));
  if (!s.exists()) throw new Error("This report link does not exist or was removed.");
  const v = s.data();
  const pages = (JSON.parse(v.pagesJson) as PageResult[]).map((p, i) => ({ ...p, faviconData: i === 0 ? v.favicon : null }));
  return {
    pages, summary: JSON.parse(v.summaryJson) as Summary, ai: JSON.parse(v.aiJson) as AiResult | null, site: JSON.parse(v.siteJson) as SiteResult | null,
    meta: { startedAt: new Date(v.analyzedAt || (v.created_at as Timestamp)?.toDate() || Date.now()), seconds: v.seconds || 0 },
    host: v.host as string,
  };
}

export async function deleteShare(id: string) {
  if (db) await deleteDoc(doc(db, "shares", id));
}
