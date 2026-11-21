"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, FileSpreadsheet, FileCode, FileJson, Globe, Table, Archive, Loader2, ChevronDown } from "lucide-react";
import type { ExportData } from "@/lib/exporters";

const ITEMS = [
  { id: "pdf", label: "PDF report", desc: "Detailed, with screenshots", icon: FileText },
  { id: "xlsx", label: "Excel (.xlsx)", desc: "One sheet per section", icon: FileSpreadsheet },
  { id: "md", label: "Markdown report (.md)", desc: "Full report + design.md", icon: FileCode },
  { id: "html", label: "HTML page", desc: "Open in any browser, with screenshots", icon: Globe },
  { id: "design", label: "design.md", desc: "Design system only", icon: FileCode },
  { id: "csv", label: "CSV (pages)", desc: "One row per page", icon: Table },
  { id: "json", label: "JSON (raw data)", desc: "For developers", icon: FileJson },
  { id: "zip", label: "Screenshots (.zip)", desc: "All page images", icon: Archive },
] as const;

export default function ExportMenu({ data }: { data: ExportData }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const hasShots = data.pages.some((p) => p.screenshot);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function run(id: string) {
    setBusy(id); setError(null);
    try {
      const x = await import("@/lib/exporters");
      if (id === "pdf") await x.exportPdf(data);
      else if (id === "xlsx") await x.exportExcel(data);
      else if (id === "md") x.exportMarkdown(data);
      else if (id === "html") x.exportHtml(data);
      else if (id === "design") x.exportDesignMd(data);
      else if (id === "csv") x.exportCsv(data);
      else if (id === "json") x.exportJson(data);
      else if (id === "zip") await x.exportScreenshotsZip(data);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:opacity-95">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Export <ChevronDown size={14} />
      </button>
      {open && (
        <div className="glass-panel absolute right-0 top-12 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-[#16162a]">
          {ITEMS.map(({ id, label, desc, icon: Icon }) => {
            const disabled = (id === "zip" && !hasShots) || (id === "design" && !data.ai?.designMd) || !!busy;
            return (
              <button key={id} disabled={disabled} onClick={() => run(id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                  {busy === id ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">{id === "pdf" && !hasShots ? "Detailed (re-crawl to add screenshots)" : desc}</div>
                </div>
              </button>
            );
          })}
          {error && <p className="m-2 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">Export failed: {error}</p>}
        </div>
      )}
    </div>
  );
}
