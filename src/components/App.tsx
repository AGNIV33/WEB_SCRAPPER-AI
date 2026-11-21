"use client";

import { useRef, useState } from "react";
import {
  LayoutDashboard, Palette, Type, FileText, Image as ImageIcon, Sparkles, Shield, Lightbulb, FileCode, Layers,
  Link2, X, Bell, Moon, Sun, Menu,
} from "lucide-react";
import { buildSummary, type LinksResult, type PageResult, type SiteResult, type Summary } from "@/lib/report";
import Dashboard, { type AiResult, type View } from "@/components/Dashboard";

type Phase = "idle" | "discover" | "pages" | "links" | "ai" | "done";

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: `Server error ${r.status}` }));
  if (!r.ok && j.error) throw new Error(j.error);
  return j as T;
}

const NAV: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "fonts", label: "Fonts", icon: Type },
  { id: "pages", label: "Pages", icon: FileText },
  { id: "screenshots", label: "Screenshots", icon: ImageIcon },
  { id: "animations", label: "Animations", icon: Sparkles },
  { id: "security", label: "Security", icon: Shield },
  { id: "suggestions", label: "Suggestions", icon: Lightbulb },
  { id: "design", label: "Design.md", icon: FileCode },
  { id: "tech", label: "Tech Stack", icon: Layers },
];

function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch { /* ignore */ }
}

export default function App() {
  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState(6);
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pages, setPages] = useState<PageResult[]>([]);
  const [site, setSite] = useState<SiteResult | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ai, setAi] = useState<AiResult | null>(null);
  const [meta, setMeta] = useState<{ startedAt: Date; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const stopRef = useRef(false);
  const busy = phase !== "idle" && phase !== "done";
  const say = (m: string) => setLog((l) => [...l.slice(-4), m]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    stopRef.current = false;
    const t0 = new Date();
    setError(null); setPages([]); setSite(null); setSummary(null); setAi(null); setLog([]); setMeta(null); setView("overview");
    try {
      setPhase("discover"); say("Finding pages…");
      const disc = await post<{ root: string; pages: string[] }>("/api/discover", { url, limit });
      say(`Found ${disc.pages.length} page(s).`);
      const sitePromise = post<SiteResult>("/api/site", { url: disc.root }).catch((e) => ({ error: e.message }) as SiteResult);

      setPhase("pages");
      const queue = [...disc.pages];
      const seen = new Set(queue.map((u) => u.replace(/\/$/, "")));
      const results: PageResult[] = [];
      setProgress({ done: 0, total: queue.length });
      const rootHost = new URL(disc.root).hostname.replace(/^www\./, "");
      let idx = 0;
      const worker = async () => {
        while (idx < queue.length && !stopRef.current) {
          const u = queue[idx++];
          say(`Scanning ${u}`);
          const r = await post<PageResult>("/api/page", { url: u, mobile: u === disc.root }).catch((e): PageResult => ({ url: u, error: e.message }));
          results.push(r);
          // JS-rendered sites: add links found by the real browser, up to the limit
          for (const l of r.links || []) {
            try {
              const x = new URL(l.href); x.hash = "";
              const k = x.toString().replace(/\/$/, "");
              if (queue.length < limit && x.hostname.replace(/^www\./, "") === rootHost && !seen.has(k) && !/\.(pdf|jpe?g|png|zip|svg|webp)$/i.test(x.pathname)) {
                seen.add(k); queue.push(x.toString());
              }
            } catch { /* skip */ }
          }
          setProgress({ done: results.length, total: queue.length });
          setPages([...results].sort((a, b) => queue.indexOf(a.url) - queue.indexOf(b.url)));
        }
      };
      await Promise.all([worker(), worker()]);
      results.sort((a, b) => queue.indexOf(a.url) - queue.indexOf(b.url));

      const siteRes = await sitePromise;
      setSite(siteRes);

      setPhase("links"); say("Checking links for 404s…");
      const allLinks = [...new Set(results.flatMap((p) => (p.links || []).map((l) => l.href.split("#")[0])))];
      const links = await post<LinksResult>("/api/links", { links: allLinks }).catch(() => null);

      const s = buildSummary(results, siteRes.error ? null : siteRes, links);
      setSummary(s);

      setPhase("ai"); say("Writing suggestions and design.md…");
      const aiRes = await post<AiResult>("/api/ai", { summary: s, textSample: results[0]?.textSample }).catch((e) => ({ ai: false, error: e.message, suggestions: [], designMd: "" }) as AiResult);
      setAi(aiRes);
      setMeta({ startedAt: t0, seconds: (Date.now() - t0.getTime()) / 1000 });
      setPhase("done"); say("Done.");
    } catch (err) {
      setError((err as Error).message);
      setPhase("idle");
    }
  }

  const pct = phase === "discover" ? 5 : phase === "pages" ? 5 + (progress.done / Math.max(progress.total, 1)) * 75 : phase === "links" ? 85 : 95;

  return (
    <div className="waves min-h-screen text-slate-800 dark:text-slate-100">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/70 bg-white/80 px-4 py-6 backdrop-blur transition-transform dark:border-white/10 dark:bg-[#12121f]/90 lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-8 flex items-center gap-3 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" className="h-10 w-10" />
          <div><div className="text-lg font-bold leading-tight tracking-tight"><span className="text-[#1e1b4b] dark:text-white">Scrapper</span> <span className="text-violet-500">AI</span></div><div className="text-xs text-slate-500 dark:text-slate-400">Website Analyzer</div></div>
          <button className="ml-auto lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setView(id); setMenuOpen(false); }}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${view === id ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25" : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"}`}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 p-4 dark:from-indigo-500/15 dark:to-violet-500/15">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300"><Sparkles size={16} /> AI-Powered Analysis</div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Design · Content · Code · UX</div>
        </div>
      </aside>
      {menuOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-[#0d0d17]/70">
          <form onSubmit={run} className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-8">
            <button type="button" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-indigo-400 dark:border-white/10 dark:bg-white/5">
              <Link2 size={18} className="shrink-0 text-slate-400" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter website URL, e.g. https://example.com" disabled={busy}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              {url && !busy && <button type="button" onClick={() => setUrl("")} aria-label="Clear" className="text-slate-400 hover:text-slate-600"><X size={16} /></button>}
            </div>
            <label className="hidden items-center gap-2 text-xs text-slate-500 sm:flex dark:text-slate-400" title="Maximum pages to crawl">
              Pages <input type="number" min={1} max={30} value={limit} onChange={(e) => setLimit(Math.max(1, Math.min(30, +e.target.value || 1)))} disabled={busy}
                className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
            </label>
            {busy ? (
              <button type="button" onClick={() => (stopRef.current = true)} className="rounded-xl bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">Stop</button>
            ) : (
              <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:opacity-95"><Sparkles size={16} /> Analyze</button>
            )}
            <button type="button" onClick={toggleTheme} aria-label="Toggle light/dark theme" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Moon size={18} className="dark:hidden" /><Sun size={18} className="hidden dark:block" />
            </button>
            <button type="button" aria-label="Notifications" className="hidden h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 sm:grid dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><Bell size={18} /></button>
            <div className="hidden h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-semibold text-white sm:grid">A</div>
          </form>
          {busy && (
            <div className="px-4 pb-3 md:px-8">
              <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate">{log[log.length - 1]}</span>
                {phase === "pages" && <span>{progress.done}/{progress.total} pages</span>}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{ width: `${pct}%` }} /></div>
            </div>
          )}
        </header>

        <main className="px-4 py-6 md:px-8">
          {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
          <Dashboard view={view} setView={setView} pages={pages} site={site} summary={summary} ai={ai} busy={busy} meta={meta} />
        </main>
      </div>
    </div>
  );
}
