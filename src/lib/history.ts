import { supabase } from "./supabase";
import type { PageResult, SiteResult, Summary } from "./report";
import type { AiResult } from "@/components/Dashboard";

export type HistoryItem = {
  id: string; url: string; host: string; created_at: string; duration_s: number | null;
  pages_count: number | null; security_score: number | null; seo_score: number | null; favicon: string | null;
};

/**
 * Saves a finished analysis for the logged-in user.
 * Screenshots are NOT saved (to keep storage small); the user re-crawls to see them again.
 */
export async function saveAnalysis(args: { pages: PageResult[]; site: SiteResult | null; summary: Summary; ai: AiResult | null; seconds: number }) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  const pages = args.pages.map((p) => ({ ...p, screenshot: undefined, mobileScreenshot: undefined }));
  const favicon = args.pages.find((p) => p.faviconData)?.faviconData || null;
  const host = (() => { try { return new URL(args.summary.url || args.pages[0].url).hostname; } catch { return args.pages[0]?.url || ""; } })();
  const { data, error } = await supabase.from("analyses").insert({
    user_id: user.id, url: args.summary.url || args.pages[0]?.url, host,
    duration_s: args.seconds, pages_count: args.summary.pagesAnalyzed,
    security_score: args.summary.security.score, seo_score: args.summary.seoScore,
    favicon: favicon && favicon.length < 60_000 ? favicon : null,
    summary: args.summary, ai: args.ai, site: args.site, pages,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function listAnalyses(): Promise<HistoryItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("analyses")
    .select("id,url,host,created_at,duration_s,pages_count,security_score,seo_score,favicon")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as HistoryItem[];
}

export async function loadAnalysis(id: string) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("analyses").select("*").eq("id", id).single();
  if (error) throw error;
  const pages = (data.pages as PageResult[]).map((p, i) => ({ ...p, faviconData: i === 0 ? data.favicon : p.faviconData }));
  return {
    pages, summary: data.summary as Summary, ai: data.ai as AiResult | null, site: data.site as SiteResult | null,
    meta: { startedAt: new Date(data.created_at), seconds: data.duration_s || 0 },
  };
}

export async function deleteAnalysis(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from("analyses").delete().eq("id", id);
  if (error) throw error;
}
