"use client";

import { useEffect, useMemo, useState } from "react";
import { GitCompareArrows, RefreshCw, ArrowUp, ArrowDown, Minus, Plus, Loader2 } from "lucide-react";
import { listAnalyses, loadAnalysis, type HistoryItem } from "@/lib/history";
import { changes, HIGHER_IS_BETTER, type Snapshot } from "@/lib/diff";
import Select from "@/components/Select";

const card = "glass-panel min-w-0 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]";
const muted = "text-slate-500 dark:text-slate-400";
const LABEL: Record<string, string> = { security: "Security score", seo: "SEO score", loadMs: "Avg load time", pages: "Pages analysed", brokenLinks: "Broken links", a11yIssues: "Accessibility issues", lcp: "LCP", cls: "CLS", tbt: "TBT", words: "Words per page", transferKB: "Page size" };
export const fmtMetric = (k: string, v: number | null) => v == null ? "—" : k === "loadMs" || k === "lcp" ? `${(v / 1000).toFixed(2)} s` : k === "tbt" ? `${Math.round(v)} ms` : k === "cls" ? v.toFixed(3) : k === "transferKB" ? `${Math.round(v)} KB` : String(Math.round(v));
const fmtDate = (d: string | Date) => new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function Chips({ title, added, removed, colors }: { title: string; added: string[]; removed: string[]; colors?: boolean }) {
  if (!added.length && !removed.length) return null;
  const chip = (x: string, add: boolean) => (
    <span key={(add ? "+" : "-") + x} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${add ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-red-100 text-red-700 line-through dark:bg-red-500/15 dark:text-red-300"}`}>
      {add ? <Plus size={12} /> : <Minus size={12} />}{colors && <span className="h-3 w-3 rounded-sm border border-black/10" style={{ background: x }} />}{x}
    </span>
  );
  return <div><div className="mb-2 text-sm font-semibold">{title}</div><div className="flex flex-wrap gap-1.5">{added.map((x) => chip(x, true))}{removed.map((x) => chip(x, false))}</div></div>;
}

/** "What changed?": compares two scans of the same website (default: the latest two). */
export default function ChangesView({ current, historyKey, onRescan }: { current: (Snapshot & { ai?: unknown }) | null; historyKey: number; onRescan: (url: string) => void }) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [host, setHost] = useState<string>("");
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [loaded, setLoaded] = useState<{ key: string; a: Snapshot; b: Snapshot } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listAnalyses().then(setItems).catch((e) => setError(e.message)); }, [historyKey]);
  const hosts = useMemo(() => [...new Set((items || []).map((i) => i.host))], [items]);
  const curHost = current ? (() => { try { return new URL(current.summary.url || "").hostname; } catch { return ""; } })() : "";
  const h = host || curHost || hosts[0] || "";
  const scans = (items || []).filter((i) => i.host === h); // newest first
  const after = afterId || scans[0]?.id || "";
  const before = beforeId || scans.find((s) => s.id !== after)?.id || "";

  const key = before && after && before !== after ? `${before}|${after}` : "";
  useEffect(() => {
    if (!key) return;
    let live = true;
    const [b0, a0] = key.split("|");
    Promise.all([loadAnalysis(b0), loadAnalysis(a0)])
      .then(([a, b]) => { if (live) { setLoaded({ key, a, b }); setError(null); } })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [key]);
  const snaps = loaded && loaded.key === key ? loaded : null;
  const loading = !!key && !snaps && !error;

  const diff = useMemo(() => (snaps ? changes(snaps.a, snaps.b) : null), [snaps]);

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold"><GitCompareArrows size={22} className="text-indigo-500" /> What changed?</h2>
        <p className={`text-sm ${muted}`}>Scan the same website again later, then compare any two scans from your history.</p>
      </div>
      <section data-anim="card" className={`${card} flex flex-wrap items-end gap-3`}>
        <div className="min-w-[180px] text-xs"><div className="mb-1">Website</div><Select ariaLabel="Website" value={h} onChange={(v) => { setHost(v); setBeforeId(""); setAfterId(""); }} options={hosts.map((x) => ({ value: x, label: x || "Saved analysis" }))} /></div>
        <div className="min-w-[200px] text-xs"><div className="mb-1">Before</div><Select ariaLabel="Before" value={before} onChange={setBeforeId} options={scans.map((s) => ({ value: s.id, label: fmtDate(s.created_at) }))} /></div>
        <div className="min-w-[200px] text-xs"><div className="mb-1">After</div><Select ariaLabel="After" value={after} onChange={setAfterId} options={scans.map((s) => ({ value: s.id, label: fmtDate(s.created_at) }))} /></div>
        {scans[0] && <button onClick={() => onRescan(scans[0].url)} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"><RefreshCw size={16} /> Scan {h} again</button>}
      </section>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {items && !hosts.length && <p className={`${card} text-sm ${muted}`}>No saved scans yet. Analyse a website while signed in, then scan it again later.</p>}
      {items && hosts.length > 0 && scans.length < 2 && <p className={`${card} text-sm ${muted}`}>Only one scan of {h} is saved. Press <b>Scan {h} again</b> to see what changed.</p>}
      {loading && <p className={`flex items-center gap-2 text-sm ${muted}`}><Loader2 size={16} className="animate-spin" /> Comparing…</p>}

      {diff && snaps && (
        <>
          <section data-anim="card" className={card}>
            <h3 className="mb-3 font-semibold">Scores</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {diff.metrics.filter((m) => m.before != null || m.after != null).map((m) => {
                const d = m.before != null && m.after != null ? m.after - m.before : 0;
                const better = d === 0 ? null : (d > 0) === HIGHER_IS_BETTER[m.key];
                return (
                  <div key={m.key} className="rounded-xl border border-slate-100 p-3 dark:border-white/5">
                    <div className={`text-xs ${muted}`}>{LABEL[m.key]}</div>
                    <div className="mt-1 flex items-center gap-2 text-lg font-bold">
                      {fmtMetric(m.key, m.after)}
                      {better !== null && <span className={`inline-flex items-center text-xs font-semibold ${better ? "text-emerald-600" : "text-red-600"}`}>{d > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}{fmtMetric(m.key, Math.abs(d))}</span>}
                    </div>
                    <div className={`text-[11px] ${muted}`}>before {fmtMetric(m.key, m.before)}</div>
                  </div>
                );
              })}
            </div>
          </section>
          <section data-anim="card" className={`${card} grid gap-5`}>
            <h3 className="font-semibold">Changes</h3>
            <Chips title="Pages" added={diff.pages.added} removed={diff.pages.removed} />
            <Chips title="Colours" added={diff.colors.added} removed={diff.colors.removed} colors />
            <Chips title="Fonts" added={diff.fonts.added} removed={diff.fonts.removed} />
            <Chips title="Tech stack" added={diff.tech.added} removed={diff.tech.removed} />
            <Chips title="Animations" added={diff.animations.added} removed={diff.animations.removed} />
            <Chips title="Broken links" added={diff.brokenLinks.added} removed={diff.brokenLinks.fixed} />
            {diff.security.length > 0 && <div><div className="mb-2 text-sm font-semibold">Security checks</div><ul className="space-y-1 text-sm">{diff.security.map((s) => <li key={s.name}>{s.name}: <b className={s.after ? "text-emerald-600" : "text-red-600"}>{s.before === undefined ? "new" : s.before ? "pass" : "fail"} → {s.after === undefined ? "removed" : s.after ? "pass" : "fail"}</b></li>)}</ul></div>}
            {diff.pageEdits.length > 0 && (
              <div><div className="mb-2 text-sm font-semibold">Page content</div>
                <div className="overflow-x-auto"><table className="w-full text-xs"><thead className={`text-left ${muted}`}><tr><th className="py-1">Page</th><th>Field</th><th>Before</th><th>After</th></tr></thead>
                  <tbody>{diff.pageEdits.map((e, i) => <tr key={i} className="border-t border-slate-100 align-top dark:border-white/5"><td className="py-1.5 pr-2">{e.page}</td><td className="pr-2">{e.field}</td><td className="pr-2 text-red-600 line-through">{e.before}</td><td className="text-emerald-700 dark:text-emerald-300">{e.after}</td></tr>)}</tbody></table></div>
              </div>
            )}
            {!diff.pages.added.length && !diff.pages.removed.length && !diff.colors.added.length && !diff.colors.removed.length && !diff.fonts.added.length && !diff.fonts.removed.length && !diff.tech.added.length && !diff.tech.removed.length && !diff.security.length && !diff.pageEdits.length && !diff.brokenLinks.added.length && !diff.brokenLinks.fixed.length && <p className={`text-sm ${muted}`}>No differences in pages, colours, fonts, tech, security or page content.</p>}
          </section>
        </>
      )}
    </div>
  );
}
