import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import type { PageResult, SiteResult, Summary } from "./report";
import type { AiResult } from "@/components/Dashboard";

/**
 * History lives in Firestore at users/{uid}/analyses/{id}.
 * Big objects are stored as JSON strings: Firestore doesn't allow nested arrays (our colour data uses them)
 * and a document must stay under 1 MB. Screenshots are never saved; users re-crawl to see them.
 */
export type HistoryItem = {
  id: string; url: string; host: string; created_at: string; duration_s: number | null;
  pages_count: number | null; security_score: number | null; seo_score: number | null; favicon: string | null;
};

const MAX_BYTES = 950_000;

function col() {
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) throw new Error("Not logged in");
  return collection(db, "users", uid, "analyses");
}

/** Drop screenshots and bulky per-page lists so the document fits Firestore's 1 MB limit. */
function compactPages(pages: PageResult[], level: number): PageResult[] {
  return pages.map((p, i) => {
    const x: PageResult = { ...p, screenshot: undefined, mobileScreenshot: undefined, faviconData: undefined };
    // inline SVGs are big data URLs: keep only real file links in history
    x.media = (p.media || []).filter((m) => !m.url.startsWith("data:")).slice(0, 200);
    if (level >= 1) { x.links = (p.links || []).slice(0, 50); x.failedRequests = undefined; x.textSample = undefined; x.media = x.media.slice(0, 80); }
    if (level >= 2 && i > 0) { x.design = undefined; x.cssVars = undefined; x.links = []; x.media = x.media?.slice(0, 20); }
    if (level >= 3 && i > 0) { x.animations = undefined; x.colors = undefined; x.typography = undefined; }
    return x;
  });
}

export async function saveAnalysis(args: { pages: PageResult[]; site: SiteResult | null; summary: Summary; ai: AiResult | null; seconds: number }) {
  const c = col();
  const favicon = args.pages.find((p) => p.faviconData)?.faviconData || null;
  const host = (() => { try { return new URL(args.summary.url || args.pages[0].url).hostname; } catch { return args.pages[0]?.url || ""; } })();
  const base = {
    url: args.summary.url || args.pages[0]?.url || "", host,
    created_at: serverTimestamp(), duration_s: args.seconds, pages_count: args.summary.pagesAnalyzed,
    security_score: args.summary.security.score, seo_score: args.summary.seoScore,
    favicon: favicon && favicon.length < 60_000 ? favicon : null,
    summaryJson: JSON.stringify(args.summary), aiJson: JSON.stringify(args.ai), siteJson: JSON.stringify(args.site),
  };
  let pagesJson = "";
  for (let level = 0; level <= 3; level++) {
    pagesJson = JSON.stringify(compactPages(args.pages, level));
    const size = pagesJson.length + base.summaryJson.length + base.aiJson.length + base.siteJson.length;
    if (size < MAX_BYTES) break;
  }
  const ref = await addDoc(c, { ...base, pagesJson });
  return ref.id;
}

export async function listAnalyses(): Promise<HistoryItem[]> {
  const snap = await getDocs(query(col(), orderBy("created_at", "desc"), limit(100)));
  return snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id, url: v.url, host: v.host,
      created_at: (v.created_at as Timestamp | null)?.toDate().toISOString() || new Date().toISOString(),
      duration_s: v.duration_s ?? null, pages_count: v.pages_count ?? null,
      security_score: v.security_score ?? null, seo_score: v.seo_score ?? null, favicon: v.favicon ?? null,
    };
  });
}

export async function loadAnalysis(id: string) {
  const d = await getDoc(doc(col(), id));
  if (!d.exists()) throw new Error("This analysis no longer exists");
  const v = d.data();
  const pages = (JSON.parse(v.pagesJson) as PageResult[]).map((p, i) => ({ ...p, faviconData: i === 0 ? v.favicon : null }));
  return {
    pages,
    summary: JSON.parse(v.summaryJson) as Summary,
    ai: JSON.parse(v.aiJson) as AiResult | null,
    site: JSON.parse(v.siteJson) as SiteResult | null,
    meta: { startedAt: (v.created_at as Timestamp | null)?.toDate() || new Date(), seconds: v.duration_s || 0 },
  };
}

export async function deleteAnalysis(id: string) {
  await deleteDoc(doc(col(), id));
}
