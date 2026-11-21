import { supabase } from "./supabase";
import type { PageResult, SiteResult, Summary } from "./report";
import type { AiResult } from "@/components/Dashboard";

export type HistoryItem = {
  id: string; url: string; host: string; created_at: string; duration_s: number | null;
  pages_count: number | null; security_score: number | null; seo_score: number | null; thumbnail_path: string | null;
  thumbUrl?: string | null;
};

const BUCKET = "screenshots";
type StoredPage = Omit<PageResult, "screenshot" | "mobileScreenshot"> & { screenshotPath?: string | null; mobilePath?: string | null };

async function upload(path: string, dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const { error } = await supabase!.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return path;
}

/** Saves a finished analysis + its screenshots for the logged-in user. */
export async function saveAnalysis(args: { pages: PageResult[]; site: SiteResult | null; summary: Summary; ai: AiResult | null; seconds: number }) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  const id = crypto.randomUUID();
  const dir = `${user.id}/${id}`;

  const stored: StoredPage[] = await Promise.all(
    args.pages.map(async (p, i) => {
      const { screenshot, mobileScreenshot, ...rest } = p;
      return {
        ...rest,
        screenshotPath: screenshot ? await upload(`${dir}/${i}.jpg`, screenshot).catch(() => null) : null,
        mobilePath: mobileScreenshot ? await upload(`${dir}/${i}-mobile.jpg`, mobileScreenshot).catch(() => null) : null,
      };
    })
  );
  const host = (() => { try { return new URL(args.summary.url || args.pages[0].url).hostname; } catch { return args.pages[0]?.url || ""; } })();
  const { error } = await supabase.from("analyses").insert({
    id, user_id: user.id, url: args.summary.url || args.pages[0]?.url, host,
    duration_s: args.seconds, pages_count: args.summary.pagesAnalyzed,
    security_score: args.summary.security.score, seo_score: args.summary.seoScore,
    summary: args.summary, ai: args.ai, site: args.site, pages: stored,
    thumbnail_path: stored.find((p) => p.screenshotPath)?.screenshotPath || null,
  });
  if (error) throw error;
  return id;
}

export async function listAnalyses(): Promise<HistoryItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("analyses")
    .select("id,url,host,created_at,duration_s,pages_count,security_score,seo_score,thumbnail_path")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const items = (data || []) as HistoryItem[];
  const paths = items.map((i) => i.thumbnail_path).filter(Boolean) as string[];
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
    const map = new Map((signed || []).map((s) => [s.path, s.signedUrl]));
    items.forEach((i) => { i.thumbUrl = i.thumbnail_path ? map.get(i.thumbnail_path) || null : null; });
  }
  return items;
}

export async function loadAnalysis(id: string) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("analyses").select("*").eq("id", id).single();
  if (error) throw error;
  const stored = data.pages as StoredPage[];
  const paths = stored.flatMap((p) => [p.screenshotPath, p.mobilePath]).filter(Boolean) as string[];
  const map = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
    (signed || []).forEach((s) => { if (s.path && s.signedUrl) map.set(s.path, s.signedUrl); });
  }
  const pages: PageResult[] = stored.map(({ screenshotPath, mobilePath, ...p }) => ({
    ...p,
    screenshot: screenshotPath ? map.get(screenshotPath) : undefined,
    mobileScreenshot: mobilePath ? map.get(mobilePath) || null : null,
  }));
  return {
    pages, summary: data.summary as Summary, ai: data.ai as AiResult | null, site: data.site as SiteResult | null,
    meta: { startedAt: new Date(data.created_at), seconds: data.duration_s || 0 },
  };
}

export async function deleteAnalysis(id: string) {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const dir = `${user.id}/${id}`;
    const { data: files } = await supabase.storage.from(BUCKET).list(dir);
    if (files?.length) await supabase.storage.from(BUCKET).remove(files.map((f) => `${dir}/${f.name}`));
  }
  const { error } = await supabase.from("analyses").delete().eq("id", id);
  if (error) throw error;
}
