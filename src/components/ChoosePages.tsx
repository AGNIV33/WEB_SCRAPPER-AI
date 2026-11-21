"use client";

import { useState } from "react";
import { FileStack, Clock, Sparkles, X } from "lucide-react";

export default function ChoosePages({ host, total, atLeast, max, initial, estimate, fmt, onStart, onCancel }: {
  host: string; total: number; atLeast: boolean; max: number; initial: number;
  estimate: (n: number) => number; fmt: (s: number) => string;
  onStart: (n: number) => void; onCancel: () => void;
}) {
  const limit = Math.max(1, Math.min(total, max));
  const [n, setN] = useState(Math.max(1, Math.min(initial, limit)));
  const presets = [...new Set([1, 5, 10, 20, 30, limit].filter((x) => x <= limit))];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#16162a]">
        <div className="mb-4 flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30"><FileStack size={20} /></div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold">How many pages?</h2>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{host}</p>
          </div>
          <button onClick={onCancel} aria-label="Cancel" className="ml-auto text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-500/10">
            <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{total}{atLeast ? "+" : ""}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">pages found on the site</div>
          </div>
          <div className="rounded-xl bg-violet-50 p-3 dark:bg-violet-500/10">
            <div className="text-2xl font-bold text-violet-700 dark:text-violet-300">{limit}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">most you can analyse{total > max ? ` (limit ${max})` : ""}</div>
          </div>
        </div>

        <label className="mb-2 flex items-baseline justify-between text-sm font-medium">
          Pages to analyse <span className="text-2xl font-bold">{n}</span>
        </label>
        <input type="range" min={1} max={limit} value={n} onChange={(e) => setN(+e.target.value)} className="w-full accent-indigo-500" aria-label="Pages to analyse" />
        <div className="mt-2 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p} onClick={() => setN(p)} className={`rounded-full px-3 py-1 text-xs font-medium ${n === p ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"}`}>
              {p === limit ? `All ${p}` : p}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
          <Clock size={16} className="text-indigo-500" />
          <span className="whitespace-nowrap">Estimated time: <b>~{fmt(estimate(n))}</b></span>
          <span className="ml-auto hidden text-right text-xs text-slate-400 sm:block">every page gets a screenshot</span>
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold dark:border-white/10">Cancel</button>
          <button onClick={() => onStart(n)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"><Sparkles size={16} /> Start analysis</button>
        </div>
      </div>
    </div>
  );
}
