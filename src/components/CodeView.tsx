"use client";

import { useMemo, useState } from "react";
import { Copy, Check, Download, Archive, Braces, Component } from "lucide-react";
import type { Summary } from "@/lib/report";
import { componentFiles, tokenFiles, type GenFile } from "@/lib/codegen";

const card = "glass-panel min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]";

function save(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = name; a.click();
}

/** Design tokens (Figma / DTCG / Tailwind / shadcn / CSS) and React + Tailwind components, with copy + download. */
export default function CodeView({ summary, host }: { summary: Summary; host: string }) {
  const groups = useMemo(() => ({ tokens: tokenFiles(summary), components: componentFiles(summary) }), [summary]);
  const [tab, setTab] = useState<"tokens" | "components">("tokens");
  const files = groups[tab];
  const [sel, setSel] = useState(0);
  const f: GenFile = files[Math.min(sel, files.length - 1)];
  const [copied, setCopied] = useState(false);

  async function zipAll() {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    groups.tokens.forEach((x) => zip.file(`tokens/${x.name}`, x.code));
    groups.components.forEach((x) => zip.file(`components/${x.name}`, x.code));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
    a.download = `${host}-design-code.zip`; a.click();
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {([["tokens", "Design tokens", Braces], ["components", "React components", Component]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => { setTab(id); setSel(0); }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${tab === id ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25" : "border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5"}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
        <button onClick={zipAll} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5"><Archive size={16} /> Download all (.zip)</button>
      </div>
      <div data-anim="card" className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap gap-1 border-b border-slate-100 p-2 dark:border-white/5">
          {files.map((x, i) => (
            <button key={x.name} onClick={() => setSel(i)} className={`rounded-lg px-3 py-1.5 font-mono text-xs ${i === sel ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5"}`}>{x.name}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <p className="flex-1 text-xs text-slate-500 dark:text-slate-400">{f.note}</p>
          <button onClick={() => { navigator.clipboard.writeText(f.code); setCopied(true); setTimeout(() => setCopied(false), 1200); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-white/10">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}</button>
          <button onClick={() => save(f.name, f.code)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white"><Download size={14} /> Download</button>
        </div>
        <pre className="max-h-[65vh] overflow-auto bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">{f.code}</pre>
      </div>
    </div>
  );
}
