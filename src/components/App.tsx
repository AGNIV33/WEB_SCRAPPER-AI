"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, Palette, Type, FileText, Image as ImageIcon, Sparkles, Shield, Lightbulb, FileCode, Layers,
  Link2, X, Bell, Moon, Sun, Menu, History, LogIn, LogOut, CloudUpload, Check, Settings as SettingsIcon, Droplets, Film, PanelLeftClose, PanelLeftOpen, Gauge, Accessibility, Braces, GitCompareArrows, Columns2, Crown, Lock,
} from "lucide-react";
import SettingsView from "@/components/SettingsView";
import SiteBackground from "@/components/SiteBackground";
import { applySettings, readSettings, useSettings } from "@/lib/settings";
import { applySiteTheme, buildSiteTheme } from "@/lib/siteTheme";
import { buildSummary, type LinksResult, type PageResult, type SiteResult, type Summary } from "@/lib/report";
import Dashboard, { type AiResult, type View as DashView } from "@/components/Dashboard";
import AuthModal from "@/components/AuthModal";
import ChoosePages from "@/components/ChoosePages";
import HistoryView from "@/components/HistoryView";
import { authEnabled, idToken, logout as fbLogout, onUser, type User } from "@/lib/firebase";
import { getUsage, recordScan, type Usage } from "@/lib/usage";
import { LockedView, PricingView } from "@/components/PlanViews";
import CompareView from "@/components/CompareView";
import ChangesView from "@/components/ChangesView";
import { loadAnalysis, saveAnalysis } from "@/lib/history";

type View = DashView | "history" | "settings" | "pricing" | "compare" | "changes";

type Phase = "idle" | "discover" | "choose" | "pages" | "links" | "ai" | "done";
type Discovery = { root: string; pages: string[]; total: number; atLeast: boolean; sitemapCount: number; maxAnalyze: number; guest?: boolean };
/** Views a guest (not signed in) may open; everything else shows a lock. */
const GUEST_VIEWS: View[] = ["overview", "colors", "fonts", "animations", "tech", "settings", "pricing"];

/** Pages scanned at the same time. Each one runs headless Chrome. */
const CONCURRENCY = 2;
/** Rough timing used for estimates before real measurements exist. */
const SEC_PER_PAGE = 12, TAIL_SEC = 35; // tail = link check + AI
export const estimateSeconds = (n: number) => Math.ceil(n / CONCURRENCY) * SEC_PER_PAGE + TAIL_SEC;
export const fmtDuration = (s: number) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m ? `${m} min ${s % 60 ? `${s % 60} s` : ""}`.trim() : `${s} s`; };

class PaywallError extends Error { constructor(msg: string, public reason: string) { super(msg); } }

/** POST to our API, with the user's login token (if signed in) so the server knows their plan. */
async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await idToken();
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: `Server error ${r.status}` }));
  if (r.status === 402) throw new PaywallError(j.error, j.paywall);
  if (!r.ok && j.error) throw new Error(j.error);
  return j as T;
}

const NAV: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "fonts", label: "Fonts", icon: Type },
  { id: "pages", label: "Pages", icon: FileText },
  { id: "screenshots", label: "Screenshots", icon: ImageIcon },
  { id: "media", label: "Media", icon: Film },
  { id: "animations", label: "Animations", icon: Sparkles },
  { id: "security", label: "Security", icon: Shield },
  { id: "speed", label: "Speed", icon: Gauge },
  { id: "a11y", label: "Accessibility", icon: Accessibility },
  { id: "suggestions", label: "Suggestions", icon: Lightbulb },
  { id: "design", label: "Design.md", icon: FileCode },
  { id: "code", label: "Tokens & Code", icon: Braces },
  { id: "tech", label: "Tech Stack", icon: Layers },
  ...(authEnabled ? [
    { id: "history" as View, label: "History", icon: History },
    { id: "changes" as View, label: "What changed", icon: GitCompareArrows },
    { id: "compare" as View, label: "Compare sites", icon: Columns2 },
    { id: "pricing" as View, label: "Plans", icon: Crown },
  ] : []),
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function App() {
  const { settings, update: updateSettings, reset: resetSettings } = useSettings();
  const mini = settings.sidebarCollapsed;
  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState(() => readSettings().defaultPages);
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number; started?: number }>({ done: 0, total: 0 });
  const [chooser, setChooser] = useState<{ disc: Discovery; resolve: (n: number | null) => void } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pages, setPages] = useState<PageResult[]>([]);
  const [site, setSite] = useState<SiteResult | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ai, setAi] = useState<AiResult | null>(null);
  const [meta, setMeta] = useState<{ startedAt: Date; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [guestRun, setGuestRun] = useState(false);
  const isLocked = (v: View) => authEnabled && !user && !GUEST_VIEWS.includes(v);
  const [authOpen, setAuthOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [historyKey, setHistoryKey] = useState(0);
  const stopRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const busy = phase !== "idle" && phase !== "done";

  // Keep the logged-in user in sync with Firebase Auth
  useEffect(() => {
    return onUser((u) => { setUser(u); if (u) getUsage().then(setUsage); else setUsage(null); });
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
      // 1) Count the site's pages first
      setPhase("discover"); say("Counting the pages on this site…");
      const disc = await post<Discovery>("/api/discover", { url });
      say(`Found ${disc.total}${disc.atLeast ? "+" : ""} page(s).`);
      setGuestRun(!!disc.guest);

      // 2) Ask how many to analyse (with max and time estimate)
      setPhase("choose");
      const chosen = await new Promise<number | null>((resolve) => setChooser({ disc, resolve }));
      setChooser(null);
      if (!chosen) { setPhase("idle"); setLog([]); return; }
      setLimit(chosen);
      const limitN = chosen;
      const sitePromise = post<SiteResult>("/api/site", { url: disc.root }).catch((e) => ({ error: e.message }) as SiteResult);

      // 3) Scan pages (2 at a time), with live time-left estimate
      setPhase("pages");
      const queue = disc.pages.slice(0, limitN);
      const seen = new Set(disc.pages.map((u) => u.replace(/\/$/, "")));
      const results: PageResult[] = [];
      const scanStart = Date.now();
      setProgress({ done: 0, total: queue.length, started: scanStart });
      const rootHost = new URL(disc.root).hostname.replace(/^www\./, "");
      const order = (a: PageResult, b: PageResult) => queue.indexOf(a.url) - queue.indexOf(b.url);
      const scanOne = (u: string) => post<PageResult>("/api/page", { url: u, mobile: u === disc.root }).catch((e): PageResult => ({ url: u, error: e.message }));
      let idx = 0;
      const worker = async () => {
        while (idx < queue.length && !stopRef.current) {
          const u = queue[idx++];
          say(`Scanning ${u}`);
          const r = await scanOne(u);
          results.push(r);
          // JS-rendered sites: if we found fewer pages than asked, add links the real browser found
          for (const l of r.links || []) {
            try {
              const x = new URL(l.href); x.hash = "";
              const k = x.toString().replace(/\/$/, "");
              if (queue.length < limitN && x.hostname.replace(/^www\./, "") === rootHost && !seen.has(k) && !/\.(pdf|jpe?g|png|zip|svg|webp)$/i.test(x.pathname)) {
                seen.add(k); queue.push(x.toString());
              }
            } catch { /* skip */ }
          }
          setProgress({ done: results.length, total: queue.length, started: scanStart });
          setPages([...results].sort(order));
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));

      // 4) Retry pages that failed or have no screenshot (once, with a short pause)
      const retry = results.filter((r) => r.error || !r.screenshot);
      if (retry.length && !stopRef.current) {
        say(`Retrying ${retry.length} page(s) that failed…`);
        await new Promise((r) => setTimeout(r, 1500));
        let j = 0;
        const rworker = async () => {
          while (j < retry.length && !stopRef.current) {
            const old = retry[j++];
            const r = await scanOne(old.url);
            if (!r.error || (r.screenshot && !old.screenshot)) results[results.indexOf(old)] = r;
            setPages([...results].sort(order));
          }
        };
        await Promise.all([rworker(), rworker()]);
      }
      results.sort(order);

      const siteRes = await sitePromise;
      setSite(siteRes);

      setPhase("links"); say("Checking links for 404s…");
      const allLinks = [...new Set(results.flatMap((p) => (p.links || []).map((l) => l.href.split("#")[0])))];
      const links = await post<LinksResult>("/api/links", { links: allLinks }).catch(() => null);

      const s = buildSummary(results, siteRes.error ? null : siteRes, links);
      setSummary(s);

      setPhase("ai"); say("Writing suggestions and design.md…");
      const aiRes = await post<AiResult>("/api/ai", { summary: s, textSample: results[0]?.textSample, screenshot: results.find((r) => r.screenshot)?.screenshot, pagesInfo: results.filter((r) => !r.error).slice(0, 15).map((r) => ({ url: r.url, title: r.seo?.title, description: r.seo?.description, h1: r.seo?.h1.slice(0, 3), h2: r.seo?.h2.slice(0, 6) })) }).catch((e) => ({ ai: false, error: e.message, suggestions: [], designMd: "" }) as AiResult);
      setAi(aiRes);
      const seconds = (Date.now() - t0.getTime()) / 1000;
      setMeta({ startedAt: t0, seconds });
      setPhase("done"); say("Done.");
      // Save to history when logged in
      if (user) {
        recordScan(disc.root).then(() => getUsage().then(setUsage)).catch(() => {});
        setSaveState("saving");
        saveAnalysis({ pages: results, site: siteRes.error ? null : siteRes, summary: s, ai: aiRes, seconds })
          .then(() => { setSaveState("saved"); setHistoryKey((k) => k + 1); })
          .catch((e) => { setSaveState("error"); setError(`Could not save to history: ${e.message}`); });
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase("idle");
      if (err instanceof PaywallError) setView("pricing");
    }
  }

  // Tick once a second while working, so "time left" counts down
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [busy]);

  // Stable values so memoised children (Dashboard, SiteBackground) don't re-render on every keystroke
  const recrawl = useCallback(() => formRef.current?.requestSubmit(), []);
  // Glass background: ONE landing-page screenshot (the homepage), prepared once in good quality
  const homeShot = useMemo(() => (settings.siteBackground ? pages.find((p) => p.screenshot)?.screenshot || null : null), [pages, settings.siteBackground]);
  // Dashboard takes on the analysed site's colours (and light/dark) when enabled
  const siteTheme = useMemo(() => (settings.siteTheme && summary ? buildSiteTheme(summary) : null), [summary, settings.siteTheme]);
  // The site decides light/dark until the user presses the theme button themselves
  const [manualTheme, setManualTheme] = useState(false);
  const [themeFor, setThemeFor] = useState(summary);
  if (themeFor !== summary) { setThemeFor(summary); setManualTheme(false); }
  useEffect(() => {
    applySiteTheme(siteTheme);
    if (siteTheme && !manualTheme) document.documentElement.classList.toggle("dark", siteTheme.dark);
    else applySettings(settings);
  }, [siteTheme, settings, manualTheme]);

  const pct = phase === "discover" ? 5 : phase === "pages" ? 5 + (progress.done / Math.max(progress.total, 1)) * 75 : phase === "links" ? 85 : phase === "choose" ? 5 : 95;
  // Time left: measured average per page once pages finish, otherwise the rough estimate
  const elapsed = progress.started ? (now - progress.started) / 1000 : 0;
  const perPage = progress.done ? elapsed / progress.done : SEC_PER_PAGE / CONCURRENCY;
  const etaSec = phase === "pages" ? Math.max(0, (progress.total - progress.done) * perPage) + TAIL_SEC : phase === "links" ? TAIL_SEC : phase === "ai" ? 20 : 0;

  return (
    <div className="waves relative min-h-screen text-slate-800 dark:text-slate-100">
      {settings.glass && (
        <SiteBackground shot={homeShot} blur={settings.bgBlur} strength={settings.bgStrength} />
      )}
      {/* Sidebar */}
      {/* Sidebar: full (w-64) or minimised to icons (w-20) on large screens; slide-in drawer on small screens */}
      <aside className={`glass-panel fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/70 bg-white py-6 transition-all duration-300 dark:border-white/10 dark:bg-[#12121f] lg:translate-x-0 ${mini ? "px-4 lg:w-20 lg:px-3" : "px-4"} ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className={`mb-6 flex items-center gap-3 px-2 ${mini ? "lg:flex-col lg:px-0" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="Scrapper AI" className="h-10 w-10 shrink-0" />
          <div className={mini ? "lg:hidden" : ""}><div className="text-lg font-bold leading-tight tracking-tight"><span className="text-[#1e1b4b] dark:text-white">Scrapper</span> <span className="text-violet-500">AI</span></div><div className="text-xs text-slate-500 dark:text-slate-400">Website Analyzer</div></div>
          <button className="ml-auto lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button>
          <button onClick={() => updateSettings({ sidebarCollapsed: !mini })} aria-label={mini ? "Expand sidebar" : "Minimise sidebar"} title={mini ? "Expand sidebar" : "Minimise sidebar"}
            className={`hidden h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5 lg:grid ${mini ? "" : "ml-auto"}`}>
            {mini ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setView(id); setMenuOpen(false); }} title={mini ? label : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${mini ? "lg:justify-center lg:px-0" : ""} ${view === id ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25" : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"}`}>
              <Icon size={18} className="shrink-0" /> <span className={`flex-1 text-left ${mini ? "lg:hidden" : ""}`}>{label}</span>
              {isLocked(id) && <Lock size={13} className={`shrink-0 opacity-60 ${mini ? "lg:hidden" : ""}`} />}
            </button>
          ))}
        </nav>
        <div className={`mt-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 p-4 dark:from-indigo-500/15 dark:to-violet-500/15 ${mini ? "lg:hidden" : ""}`}>
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300"><Sparkles size={16} /> AI-Powered Analysis</div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Design · Content · Code · UX</div>
        </div>
        {/* Creator signature */}
        <div className={`mt-3 px-2 text-center ${mini ? "lg:hidden" : ""}`}>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Crafted by</div>
          <div className="font-signature text-2xl leading-tight text-indigo-600 dark:text-indigo-300">Agniv Sarkar</div>
        </div>
        {mini && <div className="font-signature mt-3 hidden text-center text-xl text-indigo-600 dark:text-indigo-300 lg:block" title="Crafted by Agniv Sarkar">AS</div>}
      </aside>
      {menuOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <div className={`relative z-10 transition-[padding] duration-300 ${mini ? "lg:pl-20" : "lg:pl-64"}`}>
        {/* Top bar */}
        <header className="glass-panel sticky top-0 z-20 border-b border-slate-200/60 bg-white/95 dark:border-white/10 dark:bg-[#0d0d17]/95">
          <form ref={formRef} onSubmit={run} className="flex flex-wrap items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 md:px-8">
            <button type="button" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
            {/* phone: logo on the first row, URL + Analyze on their own full-width second row */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="flex items-center gap-2 sm:hidden"><img src="/logo-mark.svg" alt="" className="h-7 w-7" /><span className="text-sm font-bold"><span className="text-[#1e1b4b] dark:text-white">Scrapper</span> <span className="text-violet-500">AI</span></span></span>
            <div className="order-last flex w-full min-w-0 gap-2 sm:order-none sm:w-auto sm:flex-1 sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-indigo-400 dark:border-white/10 dark:bg-white/5">
              <Link2 size={18} className="shrink-0 text-slate-400" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter website URL, e.g. https://example.com" disabled={busy}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              {url && !busy && <button type="button" onClick={() => setUrl("")} aria-label="Clear" className="text-slate-400 hover:text-slate-600"><X size={16} /></button>}
            </div>
            {busy ? (
              <button type="button" onClick={() => (stopRef.current = true)} className="shrink-0 rounded-xl bg-slate-200 px-4 py-2.5 sm:px-5 text-sm font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">Stop</button>
            ) : (
              <button className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:opacity-95 sm:px-5"><Sparkles size={16} /> Analyze</button>
            )}
            </div>
            <button type="button" onClick={() => updateSettings({ glass: !settings.glass })} aria-label="Toggle glass mode" title="Glass mode"
              className={`ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-xl border sm:ml-0 ${settings.glass ? "border-indigo-400 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200" : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}>
              <Droplets size={18} />
            </button>
            <button type="button" onClick={() => { setManualTheme(true); updateSettings({ theme: document.documentElement.classList.contains("dark") ? "light" : "dark" }); }} aria-label="Toggle light/dark theme" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
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
              <button type="button" onClick={() => setAuthOpen(true)} aria-label="Log in" className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:px-4 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"><LogIn size={16} /> <span className="hidden sm:inline">Log in</span></button>
            ))}
          </form>
          {busy && phase !== "choose" && (
            <div className="px-4 pb-3 md:px-8">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="min-w-0 flex-1 truncate">{log[log.length - 1]}</span>
                <span className="flex items-center gap-3 font-medium">
                  {phase === "pages" && <span className="text-slate-700 dark:text-slate-200">Page {Math.min(progress.done + 1, progress.total)} of {progress.total}</span>}
                  <span>{Math.round(pct)}%</span>
                  {phase !== "discover" && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">~{fmtDuration(etaSec)} left</span>}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div className={`h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700 ${phase === "discover" ? "animate-pulse" : ""}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </header>

        <main className="px-3 py-5 sm:px-4 sm:py-6 md:px-8">
          {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
          {authEnabled && summary && view !== "history" && view !== "settings" && (
            <div className="glass-panel mb-4 flex w-fit items-center gap-2 rounded-full border border-transparent px-3 py-1 text-xs text-slate-500 dark:text-slate-400">
              {!user ? <><CloudUpload size={14} /> <button onClick={() => setAuthOpen(true)} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Log in</button> to save analyses to your history.</>
                : saveState === "saving" ? <><CloudUpload size={14} className="animate-pulse" /> Saving to history…</>
                : saveState === "saved" ? <><Check size={14} className="text-emerald-500" /> Saved to your history</>
                : null}
            </div>
          )}
          {isLocked(view)
            ? <LockedView onLogin={() => setAuthOpen(true)} />
            : view === "settings"
            ? <SettingsView settings={settings} update={updateSettings} reset={resetSettings} hasSite={pages.some((p) => p.screenshot)} />
            : view === "pricing"
            ? <PricingView usage={usage} loggedIn={!!user} onLogin={() => setAuthOpen(true)} />
            : view === "history"
            ? <HistoryView loggedIn={!!user} onLogin={() => setAuthOpen(true)} onOpen={openFromHistory} refreshKey={historyKey} />
            : view === "compare"
            ? <CompareView current={summary ? { summary, pages, ai } : null} />
            : view === "changes"
            ? <ChangesView current={summary && meta ? { summary, pages, ai, meta } : null} historyKey={historyKey} onRescan={(u: string) => { setUrl(u); setTimeout(() => formRef.current?.requestSubmit(), 50); }} />
            : <Dashboard view={view} setView={setView} pages={pages} site={site} summary={summary} ai={ai} busy={busy} meta={meta} onRecrawl={recrawl} guest={authEnabled && !user && guestRun} onLogin={() => setAuthOpen(true)} />}
        </main>
      </div>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      {chooser && (
        <ChoosePages host={new URL(chooser.disc.root).hostname} total={chooser.disc.total} atLeast={chooser.disc.atLeast} max={chooser.disc.maxAnalyze}
          initial={limit} estimate={estimateSeconds} fmt={fmtDuration} onStart={(n) => chooser.resolve(n)} onCancel={() => chooser.resolve(null)} />
      )}
    </div>
  );
}
