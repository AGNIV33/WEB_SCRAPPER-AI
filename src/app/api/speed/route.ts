/**
 * Speed score from Google PageSpeed Insights (free) + carbon estimate per visit.
 * Key: GOOGLE_API_KEY (or PAGESPEED_API_KEY). Works without a key too, but Google's shared quota is often used up.
 * Carbon: Sustainable Web Design model v4 via CO2.js, green hosting from the Green Web Foundation (free, no key).
 */
import { co2 } from "@tgwf/co2";
import { gate } from "@/lib/gate";
import { assertPublicHost, normalizeUrl } from "@/lib/url";
import type { PsiRun, SpeedResult } from "@/lib/insights";

export const maxDuration = 120;

const KEY = () => process.env.PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY || "";

const LAB = [
  ["first-contentful-paint", "First Contentful Paint"],
  ["largest-contentful-paint", "Largest Contentful Paint"],
  ["total-blocking-time", "Total Blocking Time"],
  ["cumulative-layout-shift", "Cumulative Layout Shift"],
  ["speed-index", "Speed Index"],
] as const;
const FIELD = [
  ["LARGEST_CONTENTFUL_PAINT_MS", "LCP", (v: number) => `${(v / 1000).toFixed(1)} s`],
  ["INTERACTION_TO_NEXT_PAINT", "INP", (v: number) => `${v} ms`],
  ["CUMULATIVE_LAYOUT_SHIFT_SCORE", "CLS", (v: number) => (v / 100).toFixed(2)],
  ["FIRST_CONTENTFUL_PAINT_MS", "FCP", (v: number) => `${(v / 1000).toFixed(1)} s`],
  ["EXPERIMENTAL_TIME_TO_FIRST_BYTE", "TTFB", (v: number) => `${(v / 1000).toFixed(1)} s`],
] as const;

type Audit = { title?: string; score?: number | null; displayValue?: string; numericValue?: number; details?: { type?: string; overallSavingsMs?: number }; metricSavings?: Record<string, number> };

async function psi(url: string, strategy: "mobile" | "desktop"): Promise<PsiRun> {
  const q = new URLSearchParams({ url, strategy, category: "performance" });
  if (KEY()) q.set("key", KEY());
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 100000);
  try {
    const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = j?.error?.message || `PageSpeed error ${r.status}`;
      throw new Error(r.status === 429 ? "Google's free PageSpeed quota is used up. Add GOOGLE_API_KEY to get your own free quota." : msg.slice(0, 200));
    }
    const lh = j.lighthouseResult || {};
    const audits: Record<string, Audit> = lh.audits || {};
    const score = typeof lh.categories?.performance?.score === "number" ? Math.round(lh.categories.performance.score * 100) : null;
    const metrics = LAB.map(([k, label]) => ({ key: k, label, value: audits[k]?.displayValue || "—", score: typeof audits[k]?.score === "number" ? Math.round(audits[k].score! * 100) : null }));
    const fm = j.loadingExperience?.metrics;
    const field = fm ? FIELD.filter(([k]) => fm[k]).map(([k, label, fmt]) => ({ key: k, label, value: fmt(fm[k].percentile), rating: String(fm[k].category || "").toLowerCase() })) : null;
    const opportunities = Object.values(audits)
      .filter((a) => typeof a.score === "number" && a.score < 0.9 && ((a.details?.overallSavingsMs || 0) > 0 || (a.metricSavings?.LCP || 0) > 0 || (a.metricSavings?.FCP || 0) > 0 || (a.metricSavings?.TBT || 0) > 0))
      .sort((a, b) => (b.details?.overallSavingsMs || b.metricSavings?.LCP || 0) - (a.details?.overallSavingsMs || a.metricSavings?.LCP || 0))
      .slice(0, 8)
      .map((a) => ({ title: a.title || "", saving: a.displayValue || (a.details?.overallSavingsMs ? `Save ~${(a.details.overallSavingsMs / 1000).toFixed(1)} s` : "") }));
    const bytes = typeof audits["total-byte-weight"]?.numericValue === "number" ? audits["total-byte-weight"].numericValue! : null;
    return { strategy, score, metrics, field: field && field.length ? field : null, opportunities, bytes };
  } finally {
    clearTimeout(t);
  }
}

async function greenCheck(host: string): Promise<boolean | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`https://api.thegreenwebfoundation.org/api/v3/greencheck/${encodeURIComponent(host)}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = (await r.json()) as { green?: boolean };
    return typeof j.green === "boolean" ? j.green : null;
  } catch { return null; }
}

export async function POST(req: Request) {
  const g = await gate(req, "speed", { needLogin: true });
  if (g.stop) return g.stop;
  try {
    const { url, bytes: fallbackBytes } = (await req.json()) as { url: string; bytes?: number };
    const u = normalizeUrl(url);
    await assertPublicHost(u);
    const [mobile, desktop, green] = await Promise.allSettled([psi(u.toString(), "mobile"), psi(u.toString(), "desktop"), greenCheck(u.hostname)]);
    const runs = [mobile, desktop].filter((r): r is PromiseFulfilledResult<PsiRun> => r.status === "fulfilled").map((r) => r.value);
    const err = [mobile, desktop].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;

    // Carbon per visit: page weight from PageSpeed (mobile), else what our own browser measured
    const bytes = runs.find((r) => r.bytes)?.bytes || (fallbackBytes && fallbackBytes > 0 ? fallbackBytes : 0);
    const isGreen = green.status === "fulfilled" ? green.value : null;
    let carbon: SpeedResult["carbon"];
    if (bytes) {
      const est = new co2({ model: "swd", version: 4, rating: true }).perByte(bytes, isGreen === true) as unknown as { total: number; rating: string };
      carbon = { grams: Math.round(est.total * 1000) / 1000, rating: est.rating, green: isGreen, host: u.hostname, bytes, yearlyKg10k: Math.round(est.total * 10000 * 12) / 1000 };
    }
    const out: SpeedResult = { url: u.toString(), runs, carbon };
    if (!runs.length) out.error = (err?.reason as Error)?.message || "PageSpeed did not answer";
    else if (err) out.note = (err.reason as Error)?.message;
    if (!KEY()) out.note = (out.note ? out.note + " " : "") + "Tip: add GOOGLE_API_KEY for a reliable free quota.";
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
