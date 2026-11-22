"use client";

import { useState } from "react";
import { Share2, Copy, Check, Loader2, X, ExternalLink } from "lucide-react";
import { authEnabled, auth } from "@/lib/firebase";
import { createShare } from "@/lib/share";
import type { ExportData } from "@/lib/exporters";

/** "Share" button: creates a public read-only link to this report (needs login). */
export default function ShareButton({ data }: { data: ExportData }) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (!authEnabled) return null;

  async function make() {
    if (!auth?.currentUser) { setErr("Sign in to create a share link."); return; }
    setBusy(true); setErr(null);
    try { setLink(await createShare(data)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={make} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} Share
      </button>
      {(link || err) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => { setLink(null); setErr(null); }}>
          <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#16162a]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center"><h3 className="text-lg font-bold">Share this report</h3><button onClick={() => { setLink(null); setErr(null); }} className="ml-auto text-slate-400" aria-label="Close"><X size={18} /></button></div>
            {err ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{err}</p> : (
              <>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Anyone with this link can view the report (read-only). Screenshots are not included.</p>
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 p-2 dark:border-white/10">
                  <input readOnly value={link!} className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" onFocus={(e) => e.target.select()} />
                  <button onClick={() => { navigator.clipboard.writeText(link!); setCopied(true); setTimeout(() => setCopied(false), 1200); }} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}</button>
                </div>
                <a href={link!} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-300">Open the shared page <ExternalLink size={14} /></a>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
