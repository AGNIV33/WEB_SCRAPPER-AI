"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, Palette, Type, FileText, Image as ImageIcon, Sparkles, Shield, Lightbulb, FileCode, Layers,
  Link2, X, Bell, Moon, Sun, Menu, History, LogIn, LogOut, CloudUpload, Check, Settings as SettingsIcon, Droplets,
} from "lucide-react";
import SettingsView from "@/components/SettingsView";
import SiteBackground from "@/components/SiteBackground";
import { readSettings, useSettings } from "@/lib/settings";
import { buildSummary, type LinksResult, type PageResult, type SiteResult, type Summary } from "@/lib/report";
import Dashboard, { type AiResult, type View as DashView } from "@/components/Dashboard";
import AuthModal from "@/components/AuthModal";
import HistoryView from "@/components/HistoryView";
import { authEnabled, logout as fbLogout, onUser, type User } from "@/lib/firebase";
import { loadAnalysis, saveAnalysis } from "@/lib/history";

type View = DashView | "history" | "settings";

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
  ...(authEnabled ? [{ id: "history" as View, label: "History", icon: History }] : []),
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function App() {
  const { settings, update: updateSettings, reset: resetSettings } = useSettings();
  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState(() => readSettings().defaultPages);
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
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [historyKey, setHistoryKey] = useState(0);
  const stopRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const busy = phase !== "idle" && phase !== "done";

  // Keep the logged-in user in sync with Firebase Auth
  useEffect(() => {
    return onUser(setUser);
  }, []);

  async function openFromHistory(id: string) {
    setError(null);
    try {
      const a = await loadAnalysis(id);
      setPages(a.pages); setSummary(a.summary); setAi(a.ai); setSite(a.site); setMeta(a.meta);
      setUrl(a.summary.url || ""); setPhase("done"); setSaveState("saved"); setView("overview");
    } catch (e) { setError((e as Error).message); }
  }

  async function logout() {
    await fbLogout();
    setUserMenu(false);
    if (view === "history") setView("overview");
  }
  const say = (m: string) => setLog((l) => [...l.slice(-4), m]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    stopRef.current = false;
    const t0 = new Date();
    setError(null); setPages([]); setSite(null); setSummary(null); setAi(null); setLog([]); setMeta(null); setView("overview"); setSaveState("idle");
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
      const aiRes = await post<AiResult>("/api/ai", { summary: s, textSample: results[0]?.textSample, screenshot: results.find((r) => r.screenshot)?.screenshot }).catch((e) => ({ ai: false, error: e.message, suggestions: [], designMd: "" }) as AiResult);
      setAi(aiRes);
      const seconds = (Date.now() - t0.getTime()) / 1000;
      setMeta({ startedAt: t0, seconds });
      setPhase("done"); say("Done.");
      // Save to history when logged in
      if (user) {
        setSaveState("saving");
        saveAnalysis({ pages: results, site: siteRes.error ? null : siteRes, summary: s, ai: aiRes, seconds })
          .then(() => { setSaveState("saved"); setHistoryKey((k) => k + 1); })
          .catch((e) => { setSaveState("error"); setError(`Could not save to history: ${e.message}`); });
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase("idle");
    }
  }

  // Stable values so memoised children (Dashboard, SiteBackground) don't re-render on every keystroke
  const recrawl = useCallback(() => formRef.current?.requestSubmit(), []);
  const bgShots = useMemo(() => (settings.siteBackground ? pages.filter((p) => p.screenshot).map((p) => p.screenshot!) : []), [pages, settings.siteBackground]);
  const bgColors = useMemo(() => (settings.siteBackground && summary ? [...new Set([...summary.palette.accents, ...summary.palette.backgrounds.map((c) => c.value)])].slice(0, 4) : []), [summary, settings.siteBackground]);

  const pct = phase === "discover" ? 5 : phase === "pages" ? 5 + (progress.done / Math.max(progress.total, 1)) * 75 : phase === "links" ? 85 : 95;

  return (
    <div className="waves relative min-h-screen text-slate-800 dark:text-slate-100">
      {settings.glass && (
        <SiteBackground shots={bgShots} colors={bgColors} blur={settings.bgBlur} strength={settings.bgStrength} />
      )}
      {/* Sidebar */}
      <aside className={`glass-panel fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/70 bg-white/80 px-4 py-6 backdrop-blur transition-transform dark:border-white/10 dark:bg-[#12121f]/90 lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
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

      <div className="relative z-10 lg:pl-64">
        {/* Top bar */}
        <header className="glass-panel sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-[#0d0d17]/70">
          <form ref={formRef} onSubmit={run} className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-8">
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
            <button type="button" onClick={() => updateSettings({ glass: !settings.glass })} aria-label="Toggle glass mode" title="Glass mode"
              className={`grid h-10 w-10 place-items-center rounded-xl border ${settings.glass ? "border-indigo-400 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200" : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}>
              <Droplets size={18} />
            </button>
            <button type="button" onClick={() => updateSettings({ theme: document.documentElement.classList.contains("dark") ? "light" : "dark" })} aria-label="Toggle light/dark theme" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Moon size={18} className="dark:hidden" /><Sun size={18} className="hidden dark:block" />
            </button>
            <button type="button" aria-label="Notifications" className="hidden h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 sm:grid dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><Bell size={18} /></button>
            {authEnabled && (user ? (
              <div className="relative">
                <button type="button" onClick={() => setUserMenu((o) => !o)} aria-label="Account menu"
                  className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-semibold uppercase text-white">{(user.email || "?")[0]}</button>
                {userMenu && (
                  <div className="glass-panel absolute right-0 top-12 z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl dark:border-white/10 dark:bg-[#16162a]">
                    <div className="truncate px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                    <button type="button" onClick={() => { setView("history"); setUserMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5"><History size={16} /> My history</button>
                    <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"><LogOut size={16} /> Log out</button>
                  </div>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => setAuthOpen(true)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"><LogIn size={16} /> Log in</button>
            ))}
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
          {authEnabled && summary && view !== "history" && view !== "settings" && (
            <div className="mb-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {!user ? <><CloudUpload size={14} /> <button onClick={() => setAuthOpen(true)} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Log in</button> to save analyses to your history.</>
                : saveState === "saving" ? <><CloudUpload size={14} className="animate-pulse" /> Saving to history…</>
                : saveState === "saved" ? <><Check size={14} className="text-emerald-500" /> Saved to your history</>
                : null}
            </div>
          )}
          {view === "settings"
            ? <SettingsView settings={settings} update={updateSettings} reset={resetSettings} hasSite={pages.some((p) => p.screenshot)} />
            : view === "history"
            ? <HistoryView loggedIn={!!user} onLogin={() => setAuthOpen(true)} onOpen={openFromHistory} refreshKey={historyKey} />
            : <Dashboard view={view} setView={setView} pages={pages} site={site} summary={summary} ai={ai} busy={busy} meta={meta} onRecrawl={recrawl} />}
        </main>
      </div>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
