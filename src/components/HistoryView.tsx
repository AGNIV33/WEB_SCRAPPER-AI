"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { History, Trash2, Shield, Search, FileText, LogIn, RefreshCw } from "lucide-react";
import { deleteAnalysis, listAnalyses, type HistoryItem } from "@/lib/history";

const tone = (n: number | null) => (n == null ? "bg-slate-100 text-slate-600" : n >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : n >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300");

export default function HistoryView({ loggedIn, onLogin, onOpen, refreshKey }: { loggedIn: boolean; onLogin: () => void; onOpen: (id: string) => void; refreshKey: number }) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!loggedIn) return;
    let live = true;
    listAnalyses().then((d) => { if (live) { setItems(d); setError(null); } }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [loggedIn, refreshKey, reload]);

  const card = "glass-panel min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]";

  if (!loggedIn) {
    return (
      <div className={`${card} mx-auto max-w-md p-8 text-center`}>
        <History size={32} className="mx-auto text-indigo-500" />
        <h2 className="mt-3 text-xl font-bold">Your crawl history</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Log in to save every analysis (design.md, colours, fonts, scores and more) and open it again later. Screenshots aren&apos;t saved; re-crawl to see them.</p>
        <button onClick={onLogin} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"><LogIn size={16} /> Log in</button>
      </div>
    );
  }

  const shown = (items || []).filter((i) => !q || i.host.toLowerCase().includes(q.toLowerCase()) || i.url.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold"><History size={22} className="text-indigo-500" /> History</h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">{items ? `${items.length} saved` : "Loading…"}</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by website…" className="ml-auto w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 sm:w-64 dark:border-white/10 dark:bg-white/5" />
        <button onClick={() => setReload((x) => x + 1)} aria-label="Refresh" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 dark:border-white/10"><RefreshCw size={16} /></button>
      </div>
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {items && !items.length && <p className="text-sm text-slate-500 dark:text-slate-400">No saved analyses yet. Analyze a website and it will appear here.</p>}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((i) => (
          <div key={i.id} className={`${card} group overflow-hidden`}>
            <button onClick={() => onOpen(i.id)} className="block w-full text-left">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/20">
                    {i.favicon ? <img src={i.favicon} alt="" className="h-7 w-7 object-contain" /> : <span className="grid h-full w-full place-items-center bg-gradient-to-br from-indigo-500 to-violet-500 text-base font-bold uppercase text-white">{(i.host || "?").replace(/^www\./, "")[0]}</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{i.host}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(i.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><FileText size={12} /> {i.pages_count} pages</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${tone(i.security_score)}`}><Shield size={12} /> {i.security_score}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${tone(i.seo_score)}`}><Search size={12} /> SEO {i.seo_score}</span>
                </div>
              </div>
            </button>
            <div className="flex justify-end border-t border-slate-100 px-4 py-2 dark:border-white/5">
              <button onClick={async () => { if (!confirm(`Delete the saved analysis of ${i.host}?`)) return; await deleteAnalysis(i.id).catch((e) => setError(e.message)); setReload((x) => x + 1); }}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
