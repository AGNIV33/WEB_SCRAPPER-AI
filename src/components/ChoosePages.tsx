"use client";

import { useMemo, useState } from "react";
import { FileStack, Clock, Sparkles, X, Search, ChevronRight, Layers, Home } from "lucide-react";
import type { RankedPage } from "@/lib/pagePriority";

/** Picks the pages to analyse: smart priority ticks the most important ones, the user can change them. */
export default function ChoosePages({ host, root, ranked, total, atLeast, max, initial, estimate, fmt, onStart, onCancel }: {
  host: string; root: string; ranked: RankedPage[]; total: number; atLeast: boolean; max: number; initial: number;
  estimate: (n: number) => number; fmt: (s: number) => string;
  onStart: (urls: string[]) => void; onCancel: () => void;
}) {
  const limit = Math.max(1, Math.min(ranked.length || 1, max));
  const guestOnly = max === 1;
  const main = useMemo(() => ranked.filter((r) => !r.similar), [ranked]);
  const smart = (n: number) => new Set(main.slice(0, n).map((r) => r.url));
  const [picked, setPicked] = useState<Set<string>>(() => smart(Math.max(1, Math.min(initial, limit))));
  const [q, setQ] = useState("");
  const [section, setSection] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const presets = [...new Set([5, 10, 20, 30, limit].filter((x) => x <= limit))];

  const sections = useMemo(() => {
    const c = new Map<string, number>();
    ranked.forEach((r) => { if (r.section !== "/") c.set(r.section, (c.get(r.section) || 0) + 1); });
    return [...c].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [ranked]);
  const groups = useMemo(() => {
    const g = new Map<string, RankedPage[]>();
    ranked.forEach((r) => { if (r.similar && r.group) { if (!g.has(r.group)) g.set(r.group, []); g.get(r.group)!.push(r); } });
    return [...g];
  }, [ranked]);
  const skipped = groups.reduce((n, [, l]) => n + l.length, 0);

  const match = (r: RankedPage) => (!section || r.section === section) && (!q || r.url.toLowerCase().includes(q.toLowerCase()));
  const visibleMain = main.filter(match);
  const full = picked.size >= limit;
  const toggle = (u: string) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(u)) n.delete(u); else if (n.size < limit) n.add(u);
    return n;
  });
  const selectAll = () => setPicked((s) => {
    const n = new Set(s);
    for (const r of [...visibleMain, ...ranked.filter((r) => r.similar && match(r))]) { if (n.size >= limit) break; n.add(r.url); }
    return n;
  });
  const selectNone = () => setPicked((s) => { const n = new Set(s); ranked.filter(match).forEach((r) => n.delete(r.url)); return n; });
  const isSmart = (n: number) => picked.size === n && main.slice(0, n).every((r) => picked.has(r.url));
  const label = (u: string) => { try { const x = new URL(u); return (x.pathname + x.search) || "/"; } catch { return u; } };

  const row = (r: RankedPage) => {
    const on = picked.has(r.url);
    const home = r.url === root;
    const locked = guestOnly && !home;
    return (
      <label key={r.url} className={`flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-sm ${locked || (!on && full) ? "opacity-50" : "cursor-pointer hover:bg-indigo-50/70 dark:hover:bg-white/5"}`}>
        <input type="checkbox" checked={on} disabled={locked || (!on && full)} onChange={() => toggle(r.url)} className="h-4 w-4 shrink-0 accent-indigo-500" />
        {home && <Home size={14} className="shrink-0 text-indigo-500" />}
        <span className="min-w-0 flex-1 truncate" title={r.url}>{home ? "Home page" : label(r.url)}</span>
        {r.why.filter((w) => w !== "home page").slice(0, 2).map((w) => (
          <span key={w} className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline ${w === "low value" || w === "pagination" || w === "query link" || w === "other language" ? "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400" : "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"}`}>{w}</span>
        ))}
      </label>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-4">
      <div className="glass-panel flex max-h-[92vh] w-full min-w-0 max-w-xl flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6 dark:border-white/10 dark:bg-[#16162a]">
        <div className="mb-4 flex shrink-0 items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30"><FileStack size={20} /></div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Pick pages to analyse</h2>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{host} · {total}{atLeast ? "+" : ""} pages found</p>
          </div>
          <button onClick={onCancel} aria-label="Cancel" className="ml-auto text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {guestOnly && ranked.length > 1 && (
          <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            Without an account you can analyse <b>the home page</b> (colours, fonts, animations and tech stack). <b>Sign in free</b> to pick up to 50 pages and unlock everything.
          </p>
        )}

        {!guestOnly && (
          <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400"><Sparkles size={13} className="text-indigo-500" /> Smart pick:</span>
            {presets.map((p) => (
              <button key={p} onClick={() => setPicked(smart(p))} className={`rounded-full px-3 py-1 font-medium ${isSmart(p) ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"}`}>
                Top {p}
              </button>
            ))}
          </div>
        )}

        {!guestOnly && (
          <div className="mb-2 flex shrink-0 gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages" aria-label="Search pages"
                className="w-full rounded-xl border border-slate-200 bg-white/70 py-2 pl-8 pr-3 text-sm outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-white/5" />
            </div>
            <button onClick={selectAll} className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">All</button>
            <button onClick={selectNone} className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">None</button>
          </div>
        )}

        {!guestOnly && sections.length > 0 && (
          <div className="mb-2 flex shrink-0 gap-1.5 overflow-x-auto pb-1 text-xs">
            {[[null, ranked.length] as const, ...sections].map(([s, n]) => (
              <button key={s ?? "all"} onClick={() => setSection(s)} className={`shrink-0 rounded-full px-2.5 py-1 ${section === s ? "bg-violet-500 text-white" : "bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-300"}`}>
                {s ?? "All"} <span className="opacity-70">{n}</span>
              </button>
            ))}
          </div>
        )}

        <div className="min-h-[120px] flex-1 overflow-y-auto rounded-xl border border-slate-200 p-1 dark:border-white/10">
          {visibleMain.map(row)}
          {!guestOnly && groups.map(([g, list]) => {
            const shown = list.filter(match);
            if (!shown.length) return null;
            const open = openGroups.has(g);
            return (
              <div key={g}>
                <button onClick={() => setOpenGroups((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; })}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5">
                  <ChevronRight size={14} className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
                  <Layers size={13} className="shrink-0" />
                  <span className="min-w-0 truncate"><b>{shown.length}</b> similar pages skipped <span className="opacity-70">({g}, same layout, 2 samples kept)</span></span>
                </button>
                {open && <div className="pl-5">{shown.map(row)}</div>}
              </div>
            );
          })}
          {!visibleMain.length && !groups.some(([, l]) => l.some(match)) && <p className="p-4 text-center text-sm text-slate-400">No pages match.</p>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span><b>{picked.size}</b> of {limit} picked{total > max && !guestOnly ? ` (plan limit ${max})` : ""}</span>
          {skipped > 0 && <span className="text-xs text-slate-500 dark:text-slate-400">{skipped} similar pages skipped</span>}
          <span className="ml-auto flex items-center gap-1 whitespace-nowrap text-xs"><Clock size={14} className="text-indigo-500" /> ~{fmt(estimate(picked.size || 1))}</span>
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold dark:border-white/10">Cancel</button>
          <button disabled={!picked.size} onClick={() => onStart(ranked.map((r) => r.url).filter((u) => picked.has(u)))}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50"><Sparkles size={16} /> Start analysis</button>
        </div>
      </div>
    </div>
  );
}
