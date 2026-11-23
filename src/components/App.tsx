"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, Palette, Type, FileText, Image as ImageIcon, Sparkles, Shield, Lightbulb, FileCode, Layers,
  Link2, X, Menu, History, LogIn, LogOut, CloudUpload, Check, Settings as SettingsIcon, Droplets, Film, MessageSquare, ShieldCheck, PanelLeftClose, PanelLeftOpen, Gauge, Accessibility, Braces, GitCompareArrows, Columns2, Crown, Lock, ChevronDown, BadgeCheck, Wrench, Users, TrendingUp, MessageCircleQuestion,
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
import { auth, authEnabled, flags, idToken, logout as fbLogout, onUser, refreshVerified, sendVerifyEmail, type User } from "@/lib/firebase";
import Greeting from "@/components/Greeting";
import Tour from "@/components/Tour";
import { getUsage, recordScan, type Usage } from "@/lib/usage";
import { LockedView, PricingView } from "@/components/PlanViews";
import CompareView from "@/components/CompareView";
import ChangesView from "@/components/ChangesView";
import HeroSearch from "@/components/HeroSearch";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import AdminView from "@/components/AdminView";
import ProfileModal from "@/components/ProfileModal";
import { needsProfile } from "@/lib/profile";
import ContactView from "@/components/ContactView";
import { isAccountBlocked, startHeartbeat, touchProfile, trackEvent } from "@/lib/track";
import { myFeedback, markRepliesSeen, replyKey, seenReplies } from "@/lib/feedback";
import { watchNewFeedback } from "@/lib/admin";
import { useNotifications } from "@/lib/notify";
import { loadAnalysis, saveAnalysis } from "@/lib/history";
import { loadExtras } from "@/lib/extrasClient";
import type { Extras } from "@/lib/insights";

type View = DashView | "history" | "settings" | "pricing" | "compare" | "changes" | "admin" | "contact";

type Phase = "idle" | "discover" | "choose" | "pages" | "links" | "ai" | "done";
type Discovery = { root: string; pages: string[]; total: number; atLeast: boolean; sitemapCount: number; maxAnalyze: number; guest?: boolean };
/** Views a guest (not signed in) may open; everything else shows a lock. */
const GUEST_VIEWS: View[] = ["overview", "colors", "fonts", "animations", "tech", "settings", "pricing", "contact"];

/** Pages scanned at the same time. Each one runs headless Chrome. */
const CONCURRENCY = 2;
/** Rough timing used for estimates before real measurements exist. */
const SEC_PER_PAGE = 12, TAIL_SEC = 35; // tail = link check + AI
export const estimateSeconds = (n: number) => Math.ceil(n / CONCURRENCY) * SEC_PER_PAGE + TAIL_SEC;
export const fmtDuration = (s: number) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m ? `${m} min ${s % 60 ? `${s % 60} s` : ""}`.trim() : `${s} s`; };

class PaywallError extends Error { constructor(msg: string, public reason: string) { super(msg); } }

/** POST to our API, with the user's login token (if signed in) so the server knows their plan. */
let apiCalls = 0; // API calls made during the current scan (recorded for the admin dashboard)
async function post<T>(path: string, body: unknown): Promise<T> {
  apiCalls++;
  const token = await idToken();
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: r.status === 504 ? "This page took too long to load (over 60 s)." : `Server error ${r.status}` }));
  // Some hosts return { error: { code, message } } instead of a string
  if (j.error && typeof j.error !== "string") j.error = r.status === 504 ? "This page took too long to load (over 60 s)." : j.error.message || `Server error ${r.status}`;
  if (r.status === 402) throw new PaywallError(j.error, j.paywall);
  if (!r.ok) throw new Error(j.error || `Server error ${r.status}`);
  return j as T;
}

type NavItem = { id: View; label: string; icon: React.ElementType };
/** Sidebar, grouped into collapsible categories. Items without a group title are always visible. */
const NAV_GROUPS: { id: string; title?: string; icon?: React.ElementType; items: NavItem[] }[] = [
  { id: "main", items: [{ id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "chat", label: "Ask AI", icon: MessageCircleQuestion }] },
  { id: "design", title: "Design", icon: Palette, items: [
    { id: "colors", label: "Colors", icon: Palette },
    { id: "fonts", label: "Fonts", icon: Type },
    { id: "animations", label: "Animations", icon: Sparkles },
    { id: "design", label: "Design.md", icon: FileCode },
    { id: "code", label: "Tokens & Code", icon: Braces },
  ] },
  { id: "content", title: "Content", icon: FileText, items: [
    { id: "pages", label: "Pages", icon: FileText },
    { id: "screenshots", label: "Screenshots", icon: ImageIcon },
    { id: "media", label: "Media", icon: Film },
  ] },
  { id: "audit", title: "Audit", icon: Shield, items: [
    { id: "security", label: "Security", icon: Shield },
    { id: "speed", label: "Speed", icon: Gauge },
    { id: "a11y", label: "Accessibility", icon: Accessibility },
    { id: "trust", label: "Trust check", icon: BadgeCheck },
    { id: "suggestions", label: "Suggestions", icon: Lightbulb },
    { id: "tech", label: "Tech Stack", icon: Layers },
  ] },
  { id: "grow", title: "Grow", icon: TrendingUp, items: [
    { id: "seofix", label: "SEO fixes", icon: Wrench },
    { id: "competitors", label: "Competitors", icon: Users },
  ] },
  ...(authEnabled ? [{ id: "account", title: "Account", icon: History, items: [
    { id: "history" as View, label: "History", icon: History },
    { id: "changes" as View, label: "What changed", icon: GitCompareArrows },
    { id: "compare" as View, label: "Compare sites", icon: Columns2 },
    { id: "pricing" as View, label: "Plans", icon: Crown },
  ] }] : []),
  { id: "end", items: [...(authEnabled ? [{ id: "contact" as View, label: "Contact us", icon: MessageSquare }] : []), { id: "settings" as View, label: "Settings", icon: SettingsIcon }] },
];

export default function App() {
  const { settings, update: updateSettings, reset: resetSettings } = useSettings();
  const mini = settings.sidebarCollapsed;
  // Sidebar categories that are open (remembered in this browser). Default: Design open.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem("navGroups") || "[\"design\"]")); } catch { return new Set(["design"]); } });
  const toggleGroup = (id: string) => setOpenGroups((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); try { localStorage.setItem("navGroups", JSON.stringify([...n])); } catch { /* ignore */ } return n; });
  const [urlState, setUrl] = useState("");
  const url = urlState;
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
  const [extras, setExtras] = useState<Extras | null>(null); // speed score, trust, SEO fixes, competitors
  const [meta, setMeta] = useState<{ startedAt: Date; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [profileOpen, setProfileOpen] = useState(false); // "complete your profile" (name, country, password)
  const [siteIcon, setSiteIcon] = useState<string | null>(null); // logo of the analysed website
  const [isAdmin, setIsAdmin] = useState(false); // admin account: unlimited (decided by the server)
  const [adminIssue, setAdminIssue] = useState<string | null>(null); // why the admin check failed (setup problems only)
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  function checkAdmin() {
    return idToken().then((t) => fetch("/api/me", { headers: t ? { authorization: `Bearer ${t}` } : {} })).then((r) => r.json()).then((j) => {
      setIsAdmin(!!j.admin);
      if (!j.admin) console.info("Admin check:", j.reason);
      // Ordinary users ("email-not-in-admin-list") see nothing; setup problems are shown in the account menu
      setAdminIssue(!j.admin && j.reason && j.reason !== "email-not-in-admin-list" ? j.reason : null);
    }).catch((e) => setAdminIssue(`admin check failed: ${(e as Error).message}`));
  }
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const closeTour = useCallback(() => { setTourOpen(false); try { if (auth?.currentUser) localStorage.setItem(`tourDone:${auth.currentUser.uid}`, "1"); } catch { /* ignore */ } }, []); // Google photo failed to load: show the initial instead
  const [guestRun, setGuestRun] = useState(false);
  const isLocked = (v: View) => authEnabled && !user && !GUEST_VIEWS.includes(v);
  const [authOpen, setAuthOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const notify = useNotifications(user?.uid ?? null);
  const pushNote = notify.push;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [historyKey, setHistoryKey] = useState(0);
  const stopRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const busy = phase !== "idle" && phase !== "done";
  /** A scan has started or results are on screen: the URL box moves from the page centre to the top bar. */
  const started = busy || pages.length > 0 || !!summary;

  // Keep the logged-in user in sync with Firebase Auth
  useEffect(() => {
    let had = false;
    return onUser((u) => {
      setUser(u);
      // Logged out: stop any scan and clear everything the account was looking at, so no data stays on screen
      if (!u && had) {
        stopRef.current = true;
        setPhase("idle"); setPages([]); setSite(null); setSummary(null); setAi(null); setExtras(null); setMeta(null); setLog([]); setUrl(""); setSiteIcon(null);
        setGuestRun(false); setSaveState("idle"); setUserMenu(false); setChooser(null); setView("overview"); setProfileOpen(false);
      }
      had = !!u;
      if (u) getUsage().then(setUsage); else setUsage(null);
      setIsAdmin(false); setAdminIssue(null);
      if (u) {
        // removed accounts are signed out; everyone else gets their profile refreshed for the admin dashboard
        isAccountBlocked(u.uid).then((blocked) => {
          if (blocked) { fbLogout(); setError("This account has been removed by the admin. Please contact support."); return; }
          touchProfile(u);
          if (!flags.signingUp) needsProfile(u.uid).then((need) => { if (need) setProfileOpen(true); });
          myFeedback().then((list) => {
            const seen = seenReplies(u.uid);
            list.filter((f) => f.reply && !seen.has(replyKey(f))).forEach((f) => pushNote({ kind: "info", title: "Reply to your message", body: `${f.subject}: ${f.reply!.slice(0, 120)}`, view: "contact" }));
            markRepliesSeen(u.uid, list);
          }).catch(() => {});
        });
      }
      if (u) checkAdmin();
      // Quick tour: once, for accounts created in the last 24 hours
      try {
        const isNew = Date.now() - new Date(u?.metadata.creationTime || 0).getTime() < 24 * 3600 * 1000;
        if (u && isNew && !localStorage.getItem(`tourDone:${u.uid}`)) setTimeout(() => setTourOpen(true), 900);
      } catch { /* ignore */ }
    });
  }, [pushNote]);

  // Time spent: one minute added for every minute the app is open and in focus
  const uid = user?.uid;
  useEffect(() => { if (!uid) return; return startHeartbeat(); }, [uid]);

  // Admin: new feedback shows up in the bell and as a badge on the sidebar item
  const [newFeedback, setNewFeedback] = useState(0);
  // Going to a page opens its sidebar group once; after that the user can still collapse it with the arrow
  const [seenView, setSeenView] = useState(view);
  if (seenView !== view) {
    setSeenView(view);
    const g = NAV_GROUPS.find((x) => x.title && x.items.some((i) => i.id === view));
    if (g && !openGroups.has(g.id)) setOpenGroups(new Set([...openGroups, g.id]));
  }
  const navGroups = useMemo<typeof NAV_GROUPS>(() => (isAdmin ? [...NAV_GROUPS.slice(0, -1), { id: "admin", items: [{ id: "admin" as View, label: "Admin dashboard", icon: ShieldCheck }] }, NAV_GROUPS[NAV_GROUPS.length - 1]] : NAV_GROUPS), [isAdmin]);
  const inboxCount = isAdmin ? newFeedback : 0;
  useEffect(() => {
    if (!isAdmin || !uid) return;
    const key = `seenFeedback:${uid}`;
    return watchNewFeedback((items) => {
      setNewFeedback(items.length);
      let seen: string[] = [];
      try { seen = JSON.parse(localStorage.getItem(key) || "[]"); } catch { /* ignore */ }
      const fresh = items.filter((f) => !seen.includes(f.id));
      if (!fresh.length) return;
      if (fresh.length <= 3) fresh.forEach((f) => pushNote({ kind: f.type === "issue" ? "warning" : "info", title: `${f.type === "issue" ? "New issue" : "New feedback"} from ${f.email || "a user"}`, body: f.subject, view: "admin" }));
      else pushNote({ kind: "info", title: `${fresh.length} new messages`, body: "Open the Admin dashboard, then Feedback.", view: "admin" });
      try { localStorage.setItem(key, JSON.stringify([...seen, ...fresh.map((f) => f.id)].slice(-300))); } catch { /* ignore */ }
    });
  }, [isAdmin, uid, pushNote]);

  async function openFromHistory(id: string) {
    setError(null);
    try {
      const a = await loadAnalysis(id);
      setPages(a.pages); setSummary(a.summary); setAi(a.ai); setExtras(a.ai?.extras ?? null); setSite(a.site); setMeta(a.meta);
      setUrl(a.summary.url || ""); setPhase("done"); setSaveState("saved"); setView("overview");
    } catch (e) { setError((e as Error).message); }
  }

  async function logout() {
    await fbLogout();
    setUserMenu(false);
    if (view === "history") setView("overview");
  }
  const say = (m: string) => setLog((l) => [...l.slice(-4), m]);

  async function run(e?: React.FormEvent, override?: string) {
    e?.preventDefault();
    const url = (override ?? urlState).trim();
    if (!url || busy) return;
    if (override) setUrl(override);
    stopRef.current = false;
    apiCalls = 0;
    const t0 = new Date();
    setError(null); setSiteIcon(null); setPages([]); setSite(null); setSummary(null); setAi(null); setExtras(null); setLog([]); setMeta(null); setView("overview"); setSaveState("idle");
    try {
      // 1) Count the site's pages first
      setPhase("discover"); say("Counting the pages on this site…");
      const disc = await post<Discovery>("/api/discover", { url });
      say(`Found ${disc.total}${disc.atLeast ? "+" : ""} page(s).`);
      setGuestRun(!!disc.guest);
      // Logo lookup runs next to the page scan, so the logo shows up straight away (and even if the home page is very heavy)
      const iconPromise = post<{ icon: string | null }>("/api/favicon", { url: disc.root }).then((r) => { if (r.icon) setSiteIcon(r.icon); return r.icon; }).catch(() => null);

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
      // Always keep the URL we asked for, so a failed page still shows which page it was
      const scanOne = (u: string, lite = false) => post<PageResult>("/api/page", { url: u, mobile: u === disc.root, lite }).then((r) => ({ ...r, url: r.url || u })).catch((e): PageResult => ({ url: u, error: e.message || "Could not scan this page" }));
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

      // 4) Retry pages that failed or have no screenshot, in the lighter backup mode (skips videos and
      //    slow extras), up to twice, so very heavy pages still return their data
      for (let attempt = 1; attempt <= 2 && !stopRef.current; attempt++) {
        const retry = results.filter((r) => r.error || !r.screenshot);
        if (!retry.length) break;
        say(`Retrying ${retry.length} heavy page(s) with a lighter scan${attempt > 1 ? " (last try)" : ""}…`);
        await new Promise((r) => setTimeout(r, 1500));
        let j = 0;
        const rworker = async () => {
          while (j < retry.length && !stopRef.current) {
            const old = retry[j++];
            const r = await scanOne(old.url, true);
            const better = (!r.error && (!!old.error || !!r.screenshot)) || (!!r.screenshot && !old.screenshot && !!old.error);
            if (better) results[results.indexOf(old)] = r;
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

      const icon = await iconPromise;
      if (icon && results[0] && !results.some((r) => r.faviconData)) results[0].faviconData = icon; // kept for history, exports and sharing
      const s = buildSummary(results, siteRes.error ? null : siteRes, links);
      setSummary(s);

      setPhase("ai"); say("Writing suggestions and design.md…");
      // Speed score, trust check, SEO fixes and competitors run at the same time as the AI
      const extrasPromise = loadExtras(post, disc.root, results, siteRes.error ? null : siteRes, (part) => setExtras((e) => ({ ...(e || {}), ...part })));
      const aiRes = await post<AiResult>("/api/ai", { summary: s, textSample: results[0]?.textSample, screenshot: results.find((r) => r.screenshot)?.screenshot, pagesInfo: results.filter((r) => !r.error).slice(0, 15).map((r) => ({ url: r.url, title: r.seo?.title, description: r.seo?.description, h1: r.seo?.h1.slice(0, 3), h2: r.seo?.h2.slice(0, 6) })) }).catch((e) => ({ ai: false, error: e.message, suggestions: [], designMd: "" }) as AiResult);
      setAi(aiRes);
      say("Finishing speed score, trust check and competitors…");
      const extrasRes = await extrasPromise;
      const aiToSave: AiResult = { ...aiRes, extras: extrasRes };
      const seconds = (Date.now() - t0.getTime()) / 1000;
      setMeta({ startedAt: t0, seconds });
      setPhase("done"); say("Done.");
      const host = new URL(disc.root).hostname.replace(/^www\./, "");
      const okPages = results.filter((r) => !r.error).length;
      notify.push(stopRef.current
        ? { kind: "warning", title: `Scan of ${host} stopped`, body: `${okPages} page(s) were analysed before you stopped it.`, view: "overview" }
        : { kind: "success", title: `${host} is ready`, body: `${okPages} of ${results.length} page(s) analysed in ${Math.round(seconds)}s. Security ${s.security.score}/100, SEO ${s.seoScore}/100.`, view: "overview" });
      trackEvent({ type: "scan", host, pagesOk: okPages, pagesFailed: results.length - okPages, lite: results.filter((r) => r.lite).length, seconds: Math.round(seconds), apiCalls, ai: !!aiRes.ai, status: stopRef.current ? "stopped" : "ok" });
      if (okPages < results.length) notify.push({ kind: "warning", title: `${results.length - okPages} page(s) could not be scanned`, body: "They are listed on the Pages screen. Try again later or scan fewer pages.", view: "pages" });
      if (aiRes.error) notify.push({ kind: "warning", title: "AI suggestions were skipped", body: aiRes.error, view: "suggestions" });
      // Save to history when logged in
      if (user) {
        recordScan(disc.root).then(() => getUsage().then(setUsage)).catch(() => {});
        setSaveState("saving");
        saveAnalysis({ pages: results, site: siteRes.error ? null : siteRes, summary: s, ai: aiToSave, seconds, rootUrl: disc.root })
          .then(() => { setSaveState("saved"); setHistoryKey((k) => k + 1); notify.push({ kind: "info", title: "Saved to your history", body: host, view: "history" }); })
          .catch((e) => { setSaveState("error"); setError(`Could not save to history: ${e.message}`); trackEvent({ type: "error", where: "save", message: e.message }); notify.push({ kind: "error", title: "Could not save to history", body: e.message }); });
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase("idle");
      if (err instanceof PaywallError) { setView("pricing"); notify.push({ kind: "warning", title: "Free plan limit reached", body: (err as Error).message, view: "pricing" }); }
      else {
        notify.push({ kind: "error", title: "Scan failed", body: (err as Error).message });
        let h = ""; try { h = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
        trackEvent({ type: "scan", host: h, status: "error", apiCalls, message: (err as Error).message });
      }
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
  // Dashboard takes on the analysed site's colours when enabled
  const siteTheme = useMemo(() => (settings.siteTheme && summary ? buildSiteTheme(summary) : null), [summary, settings.siteTheme]);
  // Site colours re-tint the dashboard, but light/dark always follows the user's own choice
  useEffect(() => { applySiteTheme(siteTheme); applySettings(settings); }, [siteTheme, settings]);

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
        <nav data-tour="nav" className="no-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {navGroups.map((g) => {
            // a group is open if the user opened it, or it holds the current page
            const open = !g.title || mini || openGroups.has(g.id);
            const GIcon = g.icon;
            return (
              <div key={g.id} className={g.title ? "mt-1" : ""}>
                {g.title && GIcon && (
                  <>
                    {/* minimised sidebar: a thin divider instead of the category header */}
                    {mini && <div className="mx-3 my-1.5 hidden h-px bg-slate-200 dark:bg-white/10 lg:block" />}
                    <button onClick={() => toggleGroup(g.id)} aria-expanded={open}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ${mini ? "lg:hidden" : ""}`}>
                      <GIcon size={14} className="shrink-0" /> <span className="flex-1 text-left">{g.title}</span>
                      <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
                    </button>
                  </>
                )}
                <div className={`grid transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className={`flex flex-col gap-0.5 overflow-hidden ${g.title && !mini ? "pl-2" : ""}`}>
                    {g.items.map(({ id, label, icon: Icon }) => (
                      <button key={id} data-tour={id === "settings" ? "settings" : undefined} onClick={() => { setView(id); setMenuOpen(false); }} title={mini ? label : undefined} tabIndex={open ? 0 : -1}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${mini ? "lg:justify-center lg:px-0" : ""} ${view === id ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25" : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"}`}>
                        <Icon size={18} className="shrink-0" /> <span className={`flex-1 text-left ${mini ? "lg:hidden" : ""}`}>{label}</span>
                        {id === "admin" && inboxCount > 0 && <span className={`rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white ${mini ? "lg:hidden" : ""}`}>{inboxCount}</span>}
                        {isLocked(id) && <Lock size={13} className={`shrink-0 opacity-60 ${mini ? "lg:hidden" : ""}`} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        {/* Creator signature + copyright */}
        <div className={`mt-4 border-t border-slate-200/70 px-2 pt-4 text-center dark:border-white/10 ${mini ? "lg:hidden" : ""}`}>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Crafted by</div>
          <div className="font-signature text-2xl leading-tight text-indigo-600 dark:text-indigo-300">Agniv Sarkar</div>
          <div className="mt-2 text-[11px] leading-snug text-slate-400">© {new Date().getFullYear()} Agniv Sarkar.<br />All rights reserved.</div>
        </div>
        {mini && <div className="mt-3 hidden text-center lg:block" title={`Crafted by Agniv Sarkar · © ${new Date().getFullYear()} Agniv Sarkar. All rights reserved.`}>
          <div className="font-signature text-xl text-indigo-600 dark:text-indigo-300">AS</div>
          <div className="text-[10px] text-slate-400">© {new Date().getFullYear()}</div>
        </div>}
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
            {!started && <div className="flex min-w-0 flex-1 items-center"><Greeting user={user} /></div>}
            <div className={`order-last flex w-full min-w-0 gap-2 sm:order-none sm:w-auto sm:flex-1 sm:gap-3 ${started ? "animate-[topbar-in_.5s_ease-out]" : "hidden"}`}>
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
            <button type="button" data-tour="glass" onClick={() => updateSettings({ glass: !settings.glass })} aria-label="Toggle glass mode" title="Glass mode"
              aria-pressed={settings.glass} className="tt tt-round ml-auto sm:ml-0">
              <span className="tt-sheen" aria-hidden /><Droplets size={18} strokeWidth={2.2} className="tt-icon" />
            </button>
            <span data-tour="theme" className="contents"><ThemeToggle onToggle={() => { updateSettings({ theme: document.documentElement.classList.contains("dark") ? "light" : "dark" }); }} /></span>
            <NotificationBell notes={notify.notes} unread={notify.unread} markAllRead={notify.markAllRead} remove={notify.remove} clear={notify.clear} onOpenNote={(n) => { if (n.view && !isLocked(n.view as View)) setView(n.view as View); }} />
            {authEnabled && (user ? (
              <div className="relative" data-tour="account">
                <button type="button" onClick={() => setUserMenu((o) => !o)} aria-label="Account menu"
                  className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-semibold uppercase text-white ring-2 ring-white shadow dark:ring-white/10">
                  {user.photoURL && !avatarBroken
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setAvatarBroken(true)} className="h-full w-full object-cover" />
                    : (user.displayName || user.email || "?")[0]}
                </button>
                {userMenu && (
                  <div className="absolute right-0 top-12 z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl dark:border-white/10 dark:bg-[#1b1b30]">
                    <div className="flex items-center gap-3 px-3 py-2">
                      {user.photoURL && !avatarBroken
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                        : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-semibold uppercase text-white">{(user.displayName || user.email || "?")[0]}</div>}
                      <div className="min-w-0">
                        {user.displayName && <div className="truncate text-sm font-semibold">{user.displayName}</div>}
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                        {isAdmin && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"><Crown size={10} /> Admin · Unlimited</span>}
                        {!isAdmin && adminIssue && <div className="mt-1 break-words text-[10px] text-amber-600 dark:text-amber-400">Admin check: {adminIssue}</div>}
                        {!isAdmin && adminIssue === "email-not-verified" && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <button onClick={() => sendVerifyEmail().then(() => setVerifyMsg("Link sent. Open your inbox, click it, then press \"I've verified\".")).catch((e) => setVerifyMsg((e as Error).message))} className="rounded-md bg-indigo-500 px-2 py-1 text-[10px] font-semibold text-white">Send verify email</button>
                            <button onClick={() => refreshVerified().then((ok) => { setVerifyMsg(ok ? "Verified!" : "Not verified yet. Click the link in the email first."); if (ok) checkAdmin(); }).catch((e) => setVerifyMsg((e as Error).message))} className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold dark:border-white/20">I&apos;ve verified</button>
                          </div>
                        )}
                        {!isAdmin && verifyMsg && <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{verifyMsg}</div>}
                      </div>
                    </div>
                    <button type="button" onClick={() => { setView("history"); setUserMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5"><History size={16} /> My history</button>
                    <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"><LogOut size={16} /> Log out</button>
                  </div>
                )}
              </div>
            ) : (
              <button type="button" data-tour="account" onClick={() => setAuthOpen(true)} aria-label="Log in" className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:px-4 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"><LogIn size={16} /> <span className="hidden sm:inline">Log in</span></button>
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
            : view === "admin"
            ? (isAdmin ? <AdminView currentUid={uid} /> : <p className="rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-white/10">This page is only for the admin account.</p>)
            : view === "contact"
            ? <ContactView user={user} onLogin={() => setAuthOpen(true)} context={summary?.url ? (() => { try { return new URL(summary.url).hostname; } catch { return ""; } })() : ""} notify={notify.push} />
            : view === "settings"
            ? <SettingsView settings={settings} update={updateSettings} reset={resetSettings} hasSite={pages.some((p) => p.screenshot)} onTour={() => { setView("overview"); setTimeout(() => setTourOpen(true), 300); }} />
            : view === "pricing"
            ? <PricingView usage={usage} loggedIn={!!user} admin={isAdmin} onLogin={() => setAuthOpen(true)} />
            : view === "history"
            ? <HistoryView loggedIn={!!user} onLogin={() => setAuthOpen(true)} onOpen={openFromHistory} refreshKey={historyKey} />
            : view === "compare"
            ? <CompareView current={summary ? { summary, pages, ai } : null} />
            : view === "changes"
            ? <ChangesView current={summary && meta ? { summary, pages, ai, meta } : null} historyKey={historyKey} onRescan={(u: string) => { setUrl(u); setTimeout(() => formRef.current?.requestSubmit(), 50); }} />
            : !started && !isLocked(view)
            ? <HeroSearch url={url} setUrl={setUrl} onStart={(u) => run(undefined, u)} />
            : <Dashboard view={view} setView={setView} siteIcon={siteIcon} pages={pages} site={site} summary={summary} ai={ai} busy={busy} meta={meta} extras={extras} onAnalyze={(u: string) => { setUrl(u); setTimeout(() => formRef.current?.requestSubmit(), 50); }} onRecrawl={recrawl} guest={authEnabled && !user && guestRun} onLogin={() => setAuthOpen(true)} />}
        </main>
      </div>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      {profileOpen && user && <ProfileModal user={user} onDone={() => setProfileOpen(false)} onLogout={() => { setProfileOpen(false); fbLogout(); }} />}
      <Tour open={tourOpen && !profileOpen} onClose={closeTour} />
      {chooser && (
        <ChoosePages host={new URL(chooser.disc.root).hostname} total={chooser.disc.total} atLeast={chooser.disc.atLeast} max={chooser.disc.maxAnalyze}
          initial={limit} estimate={estimateSeconds} fmt={fmtDuration} onStart={(n) => chooser.resolve(n)} onCancel={() => chooser.resolve(null)} />
      )}
    </div>
  );
}
