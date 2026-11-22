"use client";

import { useEffect, useMemo, useState } from "react";
import { Columns2, Trophy, Loader2, Check, X } from "lucide-react";
import { listAnalyses, loadAnalysis, type HistoryItem } from "@/lib/history";
import { metrics, HIGHER_IS_BETTER, type Snapshot } from "@/lib/diff";
import { fmtMetric } from "@/components/ChangesView";
import type { AiResult } from "@/components/Dashboard";

const card = "glass-panel rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]";
const muted = "text-slate-500 dark:text-slate-400";
const LABEL: Record<string, string> = { security: "Security score", seo: "SEO score", loadMs: "Avg load time", pages: "Pages analysed", brokenLinks: "Broken links", a11yIssues: "Accessibility issues", lcp: "LCP (main content)", cls: "CLS (layout shift)", tbt: "TBT (busy time)", words: "Words per page", transferKB: "Page size" };
const hostOf = (s: Snapshot) => { try { return new URL(s.summary.url || s.pages[0].url).hostname; } catch { return "site"; } };

/** Side-by-side comparison of two analyses (yours vs a competitor). Sources: current analysis + saved history. */
export default function CompareView({ current }: { current: (Snapshot & { ai: AiResult | null }) | null }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [ids, setIds] = useState<[string, string]>(["", ""]);
  const [loaded, setLoaded] = useState<{ key: string; s: [Snapshot, Snapshot] } | null>(null);

  useEffect(() => { listAnalyses().then(setItems).catch(() => setItems([])); }, []);
  const options = useMemo(() => [
    ...(current ? [{ id: "current", label: `Current: ${hostOf(current)}` }] : []),
    ...items.map((i) => ({ id: i.id, label: `${i.host} · ${new Date(i.created_at).toLocaleDateString()}` })),
  ], [items, current]);
  const a = ids[0] || options[0]?.id || "", b = ids[1] || options.find((o) => o.id !== a)?.id || "";

  const key = a && b ? `${a}|${b}` : "";
  useEffect(() => {
    if (!key) return;
    let live = true;
    const [x, y] = key.split("|");
    const get = (id: string) => (id === "current" ? Promise.resolve(current as Snapshot) : loadAnalysis(id));
    Promise.all([get(x), get(y)]).then((s) => { if (live) setLoaded({ key, s: s as [Snapshot, Snapshot] }); }).catch(() => {});
    return () => { live = false; };
  }, [key, current]);
  const [A, B] = loaded && loaded.key === key ? loaded.s : [null, null];
  const loading = !!key && !A;
  const ma = A ? metrics(A) : null, mb = B ? metrics(B) : null;
  const sel = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5";
  let winsA = 0, winsB = 0;
  const rows = ma && mb ? Object.keys(ma).map((k) => {
    const va = ma[k as keyof typeof ma], vb = mb[k as keyof typeof mb];
    let w: "a" | "b" | null = null;
    if (va != null && vb != null && va !== vb) w = (va > vb) === HIGHER_IS_BETTER[k] ? "a" : "b";
    if (w === "a") winsA++; if (w === "b") winsB++;
    return { k, va, vb, w };
  }).filter((r) => r.va != null || r.vb != null) : [];

  const col = (s: Snapshot) => (
    <div className="grid gap-4">
      <div><div className={`mb-2 text-xs font-semibold uppercase ${muted}`}>Colours</div><div className="flex flex-wrap gap-1.5">{[...s.summary.palette.backgrounds.slice(0, 5).map((c) => c.value), ...s.summary.palette.accents.slice(0, 4), ...s.summary.palette.text.slice(0, 3).map((c) => c.value)].map((h, i) => <span key={h + i} title={h} className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10" style={{ background: h }} />)}</div></div>
      <div><div className={`mb-2 text-xs font-semibold uppercase ${muted}`}>Fonts</div><ul className="text-sm">{s.summary.typography.families.slice(0, 4).map((f) => <li key={f.value} style={{ fontFamily: `"${f.value}"` }}>{f.value} <span className={`text-xs ${muted}`}>{f.share}%</span></li>)}</ul></div>
      <div><div className={`mb-2 text-xs font-semibold uppercase ${muted}`}>Tech</div><div className="flex flex-wrap gap-1.5">{s.summary.tech.map((t) => <span key={t.name} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/10">{t.name}</span>)}</div></div>
      <div><div className={`mb-2 text-xs font-semibold uppercase ${muted}`}>Security checks</div><ul className="space-y-1 text-xs">{s.summary.security.checks.map((c) => <li key={c.name} className="flex items-center gap-1.5">{c.ok ? <Check size={13} className="text-emerald-500" /> : <X size={13} className="text-red-500" />}{c.name}</li>)}</ul></div>
    </div>
  );

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold"><Columns2 size={22} className="text-indigo-500" /> Compare websites</h2>
        <p className={`text-sm ${muted}`}>Pick two analyses: your site and a competitor (analyse both first; they are saved in your history).</p>
      </div>
      {options.length < 2 ? <p className={`${card} text-sm ${muted}`}>You need at least two analyses. Analyse your site and a competitor&apos;s site while signed in, then come back here.</p> : (
        <>
          <section data-anim="card" className={`${card} grid gap-3 md:grid-cols-2`}>
            <label className="text-xs">Website A<select value={a} onChange={(e) => setIds([e.target.value, b])} className={sel}>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
            <label className="text-xs">Website B<select value={b} onChange={(e) => setIds([a, e.target.value])} className={sel}>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          </section>
          {loading && <p className={`flex items-center gap-2 text-sm ${muted}`}><Loader2 size={16} className="animate-spin" /> Loading…</p>}
          {A && B && (
            <>
              <section data-anim="card" className={card}>
                <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                  <div className="truncate text-lg font-bold">{hostOf(A)}</div>
                  <div className={`text-xs ${muted}`}>vs</div>
                  <div className="truncate text-lg font-bold">{hostOf(B)}</div>
                  <div className="text-sm"><Trophy size={14} className="mr-1 inline text-amber-500" />wins {winsA}</div><div /><div className="text-sm"><Trophy size={14} className="mr-1 inline text-amber-500" />wins {winsB}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>{rows.map((r) => (
                      <tr key={r.k} className="border-t border-slate-100 dark:border-white/5">
                        <td className={`py-2 text-right font-semibold ${r.w === "a" ? "text-emerald-600" : ""}`}>{fmtMetric(r.k, r.va)}</td>
                        <td className={`px-4 py-2 text-center text-xs ${muted}`}>{LABEL[r.k]}</td>
                        <td className={`py-2 font-semibold ${r.w === "b" ? "text-emerald-600" : ""}`}>{fmtMetric(r.k, r.vb)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </section>
              <div className="grid gap-5 md:grid-cols-2">
                <section data-anim="card" className={card}><h3 className="mb-3 font-semibold">{hostOf(A)}</h3>{col(A)}</section>
                <section data-anim="card" className={card}><h3 className="mb-3 font-semibold">{hostOf(B)}</h3>{col(B)}</section>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
