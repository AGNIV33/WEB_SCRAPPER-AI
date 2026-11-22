"use client";

import { useState } from "react";
import { Gauge, Accessibility, ExternalLink, ChevronDown, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { PageResult } from "@/lib/report";

const card = "glass-panel min-w-0 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]";
const muted = "text-slate-500 dark:text-slate-400";
const pathOf = (u: string) => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };

const tone: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "needs-improvement": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  poor: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  "n/a": "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
};
const word: Record<string, string> = { good: "Good", "needs-improvement": "Needs work", poor: "Poor", "n/a": "n/a" };

/* ---------------- Speed (Core Web Vitals) ---------------- */
const METRICS = [
  { k: "lcp", name: "LCP", full: "Largest Contentful Paint", unit: "s", fmt: (v: number) => (v / 1000).toFixed(2), tip: "When the main content (biggest image or text block) appears. Good ≤ 2.5 s." },
  { k: "cls", name: "CLS", full: "Cumulative Layout Shift", unit: "", fmt: (v: number) => v.toFixed(3), tip: "How much the page jumps while loading. Good ≤ 0.1." },
  { k: "tbt", name: "TBT", full: "Total Blocking Time (stands in for INP)", unit: "ms", fmt: (v: number) => String(Math.round(v)), tip: "How long the page was too busy to react to clicks. INP needs real users, so lab tools use TBT. Good ≤ 200 ms." },
  { k: "fcp", name: "FCP", full: "First Contentful Paint", unit: "s", fmt: (v: number) => (v / 1000).toFixed(2), tip: "When the first text or image appears. Good ≤ 1.8 s." },
] as const;

export function SpeedView({ pages }: { pages: PageResult[] }) {
  const ok = pages.filter((p) => p.vitals);
  if (!ok.length) return <div className={`${card} text-sm ${muted}`}>No speed data. Run a new analysis (older scans don&apos;t have it).</div>;
  const worst = (k: string) => {
    const order = ["poor", "needs-improvement", "good", "n/a"];
    return ok.map((p) => p.vitals!.ratings[k as "lcp"]).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
  };
  const avg = (k: "lcp" | "cls" | "tbt" | "fcp") => { const v = ok.map((p) => p.vitals![k]).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return (
    <div className="grid gap-5">
      <p className={`text-sm ${muted}`}>Measured in our own Chrome (lab test, desktop, like Google PageSpeed&apos;s lab data). Real visitors on slow phones may see slower numbers.</p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((m) => {
          const a = avg(m.k);
          const r = worst(m.k);
          return (
            <div key={m.k} data-anim="card" className={card}>
              <div className="flex items-start justify-between"><div className="text-sm font-semibold">{m.name}</div><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone[r]}`}>{word[r]}</span></div>
              <div className="mt-2 text-3xl font-bold">{a == null ? "—" : m.fmt(a)}<span className="ml-1 text-base text-slate-400">{m.unit}</span></div>
              <div className={`mt-1 text-xs ${muted}`}>{m.full} · average</div>
              <p className={`mt-3 text-xs ${muted}`}>{m.tip}</p>
            </div>
          );
        })}
      </div>
      <section data-anim="card" className={card}>
        <h3 className="mb-3 flex items-center gap-2 font-semibold"><Gauge size={18} className="text-indigo-500" /> By page</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={`text-left text-xs ${muted}`}><tr><th className="py-2">Page</th>{METRICS.map((m) => <th key={m.k}>{m.name}</th>)}</tr></thead>
            <tbody>
              {ok.map((p) => (
                <tr key={p.url} className="border-t border-slate-100 dark:border-white/5">
                  <td className="max-w-[240px] truncate py-2">{pathOf(p.url)}</td>
                  {METRICS.map((m) => { const v = p.vitals![m.k]; const r = p.vitals!.ratings[m.k]; return <td key={m.k}><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone[r]}`}>{v == null ? "n/a" : `${m.fmt(v)}${m.unit ? " " + m.unit : ""}`}</span></td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Accessibility (axe-core) ---------------- */
const impactTone: Record<string, string> = { critical: tone.poor, serious: tone.poor, moderate: tone["needs-improvement"], minor: tone["n/a"] };

export function A11yView({ pages }: { pages: PageResult[] }) {
  const ok = pages.filter((p) => p.a11y);
  const [open, setOpen] = useState<string | null>(null);
  if (!ok.length) return <div className={`${card} text-sm ${muted}`}>No accessibility data. Run a new analysis (older scans don&apos;t have it).</div>;
  // merge issues across pages
  const map = new Map<string, { id: string; impact: string | null; help: string; description: string; helpUrl: string; count: number; pages: { url: string; targets: string[] }[] }>();
  ok.forEach((p) => p.a11y!.violations.forEach((v) => {
    const e = map.get(v.id) || { ...v, count: 0, pages: [] };
    e.count += v.count; e.pages.push({ url: p.url, targets: v.targets }); map.set(v.id, e);
  }));
  const order = ["critical", "serious", "moderate", "minor"];
  const issues = [...map.values()].sort((a, b) => order.indexOf(a.impact || "minor") - order.indexOf(b.impact || "minor") || b.count - a.count);
  const by = (i: string) => issues.filter((x) => x.impact === i).length;
  const score = Math.max(0, 100 - by("critical") * 15 - by("serious") * 8 - by("moderate") * 4 - by("minor") * 1);
  return (
    <div className="grid gap-5">
      <p className={`text-sm ${muted}`}>Automatic WCAG 2.1 A/AA checks with axe-core (the engine used by Lighthouse). Automatic tools catch about a third of issues; keyboard and screen-reader testing is still worth doing.</p>
      <div className="grid grid-cols-2 gap-5 md:grid-cols-5">
        <div data-anim="card" className={card}><div className={`text-xs ${muted}`}>Score</div><div className="text-3xl font-bold">{score}<span className="text-base text-slate-400">/100</span></div></div>
        {order.map((i) => <div key={i} data-anim="card" className={card}><div className={`text-xs capitalize ${muted}`}>{i}</div><div className="text-3xl font-bold">{by(i)}</div></div>)}
      </div>
      <section data-anim="card" className={card}>
        <h3 className="mb-3 flex items-center gap-2 font-semibold"><Accessibility size={18} className="text-indigo-500" /> Issues ({issues.length})</h3>
        {!issues.length && <p className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 size={16} /> No automatic issues found.</p>}
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {issues.map((v) => (
            <li key={v.id} className="py-3">
              <button onClick={() => setOpen(open === v.id ? null : v.id)} className="flex w-full items-start gap-3 text-left">
                {v.impact === "critical" || v.impact === "serious" ? <XCircle size={18} className="mt-0.5 shrink-0 text-red-500" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{v.help}</div>
                  <div className={`text-xs ${muted}`}>{v.count} element(s) on {v.pages.length} page(s)</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${impactTone[v.impact || "minor"]}`}>{v.impact || "minor"}</span>
                <ChevronDown size={16} className={`mt-1 shrink-0 text-slate-400 transition ${open === v.id ? "rotate-180" : ""}`} />
              </button>
              {open === v.id && (
                <div className={`ml-8 mt-2 space-y-2 text-xs ${muted}`}>
                  <p>{v.description}</p>
                  {v.pages.map((p) => <div key={p.url}><b className="text-slate-700 dark:text-slate-200">{pathOf(p.url)}</b>{p.targets.map((t) => <code key={t} className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 dark:bg-white/10">{t}</code>)}</div>)}
                  <a href={v.helpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-300">How to fix <ExternalLink size={12} /></a>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
