"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Palette, Type, FileText, Sparkles, Shield, Gauge, Accessibility, Lightbulb, FileCode, Layers, Loader2 } from "lucide-react";
import Dashboard, { type View } from "@/components/Dashboard";
import { loadShare } from "@/lib/share";

const TABS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "colors", label: "Colors", icon: Palette }, { id: "fonts", label: "Fonts", icon: Type },
  { id: "pages", label: "Pages", icon: FileText }, { id: "animations", label: "Animations", icon: Sparkles }, { id: "security", label: "Security", icon: Shield },
  { id: "speed", label: "Speed", icon: Gauge }, { id: "a11y", label: "Accessibility", icon: Accessibility }, { id: "suggestions", label: "Suggestions", icon: Lightbulb },
  { id: "design", label: "Design.md", icon: FileCode }, { id: "tech", label: "Tech", icon: Layers },
];

/** Read-only view of a shared report. */
export default function SharedReport() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadShare>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("overview");

  useEffect(() => { loadShare(id).then(setData).catch((e) => setError(e.message)); }, [id]);

  return (
    <div className="waves min-h-screen text-slate-800 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/95 dark:border-white/10 dark:bg-[#0d0d17]/95">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <img src="/logo-mark.svg" alt="" className="h-8 w-8" />
          <div className="text-sm font-bold"><span className="text-[#1e1b4b] dark:text-white">Scrapper</span> <span className="text-violet-500">AI</span> <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">Shared report · read-only</span></div>
          <Link href="/" className="ml-auto rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-xs font-semibold text-white">Analyse your own site</Link>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map(({ id: t, label, icon: Icon }) => (
            <button key={t} onClick={() => setView(t)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${view === t ? "bg-indigo-500 text-white" : "text-slate-600 hover:bg-indigo-50 dark:text-slate-300 dark:hover:bg-white/5"}`}><Icon size={14} /> {label}</button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        {!data && !error && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading report…</p>}
        {data && <Dashboard view={view} setView={setView} pages={data.pages} site={data.site} summary={data.summary} ai={data.ai} busy={false} meta={data.meta} readOnly />}
        <footer className="mt-10 text-center text-xs text-slate-400">Made with Scrapper AI · crafted by <span className="font-signature text-base text-indigo-500">Agniv Sarkar</span></footer>
      </main>
    </div>
  );
}
