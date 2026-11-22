"use client";
/* eslint-disable @next/next/no-img-element */

import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  FileText, Shield, Search, Gauge, Palette, Type, Image as ImageIcon, Sparkles, Lightbulb, FileCode, Layers,
  ExternalLink, Link2, Download, RefreshCw, ChevronDown, Lock, Copy, Check, AlertTriangle, ShieldCheck, ShieldAlert, Info, Globe, Rocket, Eye, Wand2,
} from "lucide-react";
gsap.registerPlugin(useGSAP);
import ExportMenu from "@/components/ExportMenu";
import MediaView from "@/components/MediaView";
import ScreenshotGallery from "@/components/ScreenshotGallery";
import { A11yView, SpeedView } from "@/components/AuditViews";
import CodeView from "@/components/CodeView";
import { LockedCard } from "@/components/PlanViews";
import ShareButton from "@/components/ShareButton";
import { contrast, type PageResult, type SiteResult, type Summary } from "@/lib/report";

export type View = "overview" | "colors" | "fonts" | "pages" | "screenshots" | "media" | "speed" | "a11y" | "code" | "animations" | "security" | "suggestions" | "design" | "tech";
export type AiResult = {
  ai: boolean; model?: string; note?: string; error?: string | null;
  suggestions: { area: string; priority: string; title: string; detail: string }[];
  designMd: string; rawDesignMd?: string;
  about?: { summary: string; whatItIs: string; audience: string; offerings: string[]; sections: string[]; tone: string; mainAction: string };
};
type Props = {
  view: View; setView: (v: View) => void; pages: PageResult[]; site: SiteResult | null; summary: Summary | null;
  ai: AiResult | null; busy: boolean; meta: { startedAt: Date; seconds: number } | null; onRecrawl?: () => void; guest?: boolean; onLogin?: () => void; readOnly?: boolean; siteIcon?: string | null;
};

/** Re-crawl action for saved analyses (they have no screenshots). */
const RecrawlCtx = createContext<(() => void) | undefined>(undefined);
function NoShots({ compact }: { compact?: boolean }) {
  const recrawl = useContext(RecrawlCtx);
  return (
    <div className={`grid place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-white/15 dark:bg-white/5 ${compact ? "p-4" : "p-10"}`}>
      <div>
        <ImageIcon size={compact ? 22 : 32} className="mx-auto text-slate-400" />
        <p className="mt-2 text-sm font-medium">Screenshots aren&apos;t saved in history</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Re-crawl the site to see them again.</p>
        {recrawl && <button onClick={recrawl} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/25"><RefreshCw size={14} /> Re-crawl to see screenshots</button>}
      </div>
    </div>
  );
}

/* ---------- small UI pieces ---------- */
const card = "glass-panel min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a] dark:shadow-none";
const muted = "text-slate-500 dark:text-slate-400";

function Card({ title, icon: Icon, right, children, className = "", onMore }: { title?: string; icon?: React.ElementType; right?: React.ReactNode; children: React.ReactNode; className?: string; onMore?: () => void }) {
  return (
    <section data-anim="card" className={`${card} p-5 ${className}`}>
      {title && (
        <div className="mb-4 flex items-center gap-2">
          {Icon && <Icon size={18} className="shrink-0 text-indigo-500" />}
          <h3 className="font-semibold">{title}</h3>
          <div className={`ml-auto flex items-center gap-3 text-xs ${muted}`}>
            {right}
            {onMore && <button onClick={onMore} className="whitespace-nowrap font-medium text-indigo-600 hover:underline dark:text-indigo-400">View all</button>}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

type Tone = "red" | "amber" | "green" | "blue" | "violet" | "slate";
const toneCls: Record<Tone, string> = {
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
};
const Badge = ({ children, tone = "slate" }: { children: React.ReactNode; tone?: Tone }) => (
  <span data-pop className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${toneCls[tone]}`}>{children}</span>
);
const sevTone = (s: string): Tone => (s === "high" ? "red" : s === "medium" ? "amber" : s === "low" ? "slate" : "blue");
const scoreTone = (n: number): Tone => (n >= 80 ? "green" : n >= 50 ? "amber" : "red");
const scoreWord = (n: number) => (n >= 80 ? "Good" : n >= 50 ? "Moderate" : "Poor");

type Tint = "violet" | "amber" | "green" | "blue" | "red";
const tintCls: Record<Tint, { card: string; glow: string; icon: string }> = {
  violet: { card: "from-violet-50 via-white to-white text-violet-600 dark:from-violet-500/20 dark:via-violet-500/5 dark:to-transparent dark:text-violet-300", glow: "bg-violet-400/30 dark:bg-violet-500/25", icon: "from-violet-500 to-indigo-500" },
  amber: { card: "from-amber-50 via-white to-white text-amber-600 dark:from-amber-500/20 dark:via-amber-500/5 dark:to-transparent dark:text-amber-300", glow: "bg-amber-400/30 dark:bg-amber-500/25", icon: "from-amber-400 to-orange-500" },
  green: { card: "from-emerald-50 via-white to-white text-emerald-600 dark:from-emerald-500/20 dark:via-emerald-500/5 dark:to-transparent dark:text-emerald-300", glow: "bg-emerald-400/30 dark:bg-emerald-500/25", icon: "from-emerald-400 to-teal-500" },
  blue: { card: "from-sky-50 via-white to-white text-sky-600 dark:from-sky-500/20 dark:via-sky-500/5 dark:to-transparent dark:text-sky-300", glow: "bg-sky-400/30 dark:bg-sky-500/25", icon: "from-sky-400 to-blue-500" },
  red: { card: "from-red-50 via-white to-white text-red-600 dark:from-red-500/20 dark:via-red-500/5 dark:to-transparent dark:text-red-300", glow: "bg-red-400/30 dark:bg-red-500/25", icon: "from-red-400 to-rose-500" },
};

function StatCard({ label, value, sub, subTone, icon: Icon, tint, chart, foot }: { label: string; value: React.ReactNode; sub?: string; subTone?: Tone; icon: React.ElementType; tint: Tint; chart?: React.ReactNode; foot?: React.ReactNode }) {
  const t = tintCls[tint];
  return (
    <div data-anim="card" className={`${card} group relative overflow-hidden bg-gradient-to-br p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_-12px_rgba(99,102,241,0.35)] ${t.card}`}>
      {/* soft glow blob */}
      <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-125 ${t.glow}`} />
      <div className="relative flex items-start justify-between">
        <div className={`text-sm font-medium ${muted}`}>{label}</div>
        <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg ${t.icon}`}><Icon size={20} /></div>
      </div>
      <div className="relative mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</div>
          {sub && <div className="mt-1.5"><Badge tone={subTone}>{sub}</Badge></div>}
        </div>
        {chart && <div className="shrink-0">{chart}</div>}
      </div>
      {foot && <div className={`relative mt-4 border-t border-black/5 pt-3 text-xs dark:border-white/10 ${muted}`}>{foot}</div>}
    </div>
  );
}

/** Circular score gauge (0–100). Uses the card's text colour. */
function Ring({ value, size = 76 }: { value: number; size?: number }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={8} />
      <circle data-ring data-full={c} data-off={off} cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={8} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
    </svg>
  );
}

/** Mini bar chart: one bar per page. */
function Bars({ values, labels }: { values: number[]; labels?: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-16 items-end gap-1">
      {values.slice(0, 12).map((v, i) => (
        <div key={i} title={labels?.[i]} data-bar className="w-2.5 rounded-t-md bg-current opacity-80 transition-opacity hover:opacity-100" style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

/** Mini line + area chart. */
function Spark({ values: raw, w = 110, h = 56 }: { values: number[]; w?: number; h?: number }) {
  const values = raw.length < 2 ? [raw[0] || 0, raw[0] || 0] : raw;
  const max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 6) + 3, h - 6 - ((v - min) / span) * (h - 14)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const id = "sg" + values.length + Math.round(max);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity="0.35" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      <path data-area d={`${line} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`} fill={`url(#${id})`} />
      <path data-spark d={line} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} data-pop cx={x} cy={y} r={2.5} fill="currentColor" />)}
    </svg>
  );
}

function download(name: string, text: string, type = "text/markdown") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1000); }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
      {ok ? <Check size={14} /> : <Copy size={14} />} {ok ? "Copied" : label}
    </button>
  );
}

function Swatch({ hex, label, big }: { hex: string; label?: string; big?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(hex); setOk(true); setTimeout(() => setOk(false), 900); }} className="group min-w-0 text-left" title="Click to copy" data-pop>
      <div className={`${big ? "h-24" : "h-14"} w-full rounded-xl border border-slate-200 shadow-sm transition group-hover:scale-[1.03] dark:border-white/10`} style={{ background: hex }} />
      <div className="mt-1.5 truncate font-mono text-xs font-medium uppercase">{ok ? "Copied!" : hex}</div>
      {label && <div className={`text-[11px] ${muted}`}>{label}</div>}
    </button>
  );
}

/** Loads Google Fonts versions of detected families so they render in their own font (fails silently for non-Google fonts). */
function useGoogleFonts(families: string[]) {
  const key = families.join("|");
  useEffect(() => {
    const generic = /^(serif|sans-serif|monospace|system-ui|-apple-system|blinkmacsystemfont|segoe ui|arial|helvetica|times new roman|georgia)$/i;
    for (const f of key.split("|").filter((x) => x && !generic.test(x))) {
      const id = "gf-" + f.replace(/\W/g, "");
      if (document.getElementById(id)) continue;
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet";
      l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f)}:wght@300;400;500;600;700&display=swap`;
      document.head.appendChild(l);
    }
  }, [key]);
}

const pathOf = (u: string) => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };
const hostOf = (u?: string) => { try { return new URL(u!).hostname; } catch { return u || ""; } };

/* ---------- main ---------- */
/** Memoised: typing in the URL box or other app-level state changes no longer re-render the whole dashboard. */
const Dashboard = memo(function Dashboard(props: Props) {
  return <RecrawlCtx.Provider value={props.onRecrawl}><DashboardInner {...props} /></RecrawlCtx.Provider>;
});
export default Dashboard;

function DashboardInner({ view, setView, pages, site, summary: s, ai, busy, meta, guest, onLogin, readOnly, siteIcon }: Props) {
  /** Guests see these cards blurred with a "Sign in" button. */
  const lock = (meta: { title: string; icon: React.ElementType; teaser: string; compact?: boolean }, node: React.ReactNode) => (guest && onLogin ? <LockedCard onLogin={onLogin} {...meta} /> : node);
  useGoogleFonts(s?.typography.families.map((f) => f.value) || []);
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (document.documentElement.classList.contains("no-motion")) return; // turned off in Settings
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.from(q("[data-anim=card]"), { y: 28, opacity: 0, duration: 0.6, ease: "power3.out", stagger: 0.06, clearProps: "transform,opacity" });
      gsap.from(q("[data-pop]"), { scale: 0.6, opacity: 0, transformOrigin: "50% 50%", duration: 0.45, ease: "back.out(2)", stagger: { each: 0.02, from: "start" }, delay: 0.25, clearProps: "transform,opacity" });
      // Stat tile charts
      // fromTo with explicit end values, so re-runs (when AI results arrive) never capture a half-finished state
      q("[data-ring]").forEach((el) => gsap.fromTo(el, { attr: { "stroke-dashoffset": el.getAttribute("data-full") || 0 } }, { attr: { "stroke-dashoffset": el.getAttribute("data-off") || 0 }, duration: 1.4, ease: "power3.out", delay: 0.3 }));
      gsap.from(q("[data-bar]"), { scaleY: 0, transformOrigin: "50% 100%", duration: 0.7, ease: "back.out(1.6)", stagger: 0.05, delay: 0.3, clearProps: "transform" });
      q("[data-grow]").forEach((el) => gsap.fromTo(el, { width: 0 }, { width: el.getAttribute("data-w") || "0%", duration: 1.1, ease: "power3.out", delay: 0.4 }));
      gsap.from(q("[data-area]"), { opacity: 0, duration: 0.8, delay: 0.9 });
      q("[data-spark]").forEach((el) => {
        const len = (el as unknown as SVGPathElement).getTotalLength();
        gsap.fromTo(el, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.3, ease: "power2.inOut", delay: 0.3, clearProps: "strokeDasharray,strokeDashoffset" });
      });
      gsap.from(q("tbody tr, [data-row]"), { x: -12, opacity: 0, duration: 0.4, ease: "power2.out", stagger: 0.03, delay: 0.2, clearProps: "transform,opacity" });
      q("[data-count]").forEach((el) => {
        const end = parseFloat((el as HTMLElement).dataset.count || "0"), d = parseInt((el as HTMLElement).dataset.dec || "0");
        const o = { v: 0 };
        gsap.to(o, { v: end, duration: 1.3, ease: "power2.out", delay: 0.2, onUpdate: () => { el.textContent = o.v.toFixed(d); } });
      });
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [view, !!s, !!ai, pages.length] });
  const okPages = pages.filter((p) => !p.error);
  const home = okPages[0];

  if (!pages.length && !busy) return <div ref={root}><Empty /></div>;

  const header = (
    // relative z-10 (below the sticky top bar at z-20): the glass blur makes this panel its own layer, so it must sit above the cards below,
    // otherwise the Export menu opens *behind* them
    <div className="glass-panel relative z-10 mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-transparent p-3">{/* gets a frosted panel in glass mode so the title stays readable */}
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/20">
        <Favicon key={`${home?.url}|${siteIcon ? 1 : 0}`} host={hostOf(home?.finalUrl || pages[0]?.url)} srcs={[home?.faviconData, siteIcon, home?.seo?.favicon].filter(Boolean) as string[]} />
      </div>
      <div className="min-w-0">
        <a href={home?.finalUrl || pages[0]?.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xl font-bold hover:text-indigo-600">
          <span className="truncate">{hostOf(home?.finalUrl || pages[0]?.url) || "Starting…"}</span> <ExternalLink size={16} className="shrink-0 text-slate-400" />
        </a>
        <div className={`text-sm ${muted}`}>
          {meta ? <>Analyzed on {meta.startedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} • Completed in {meta.seconds.toFixed(1)}s</> : "Analyzing…"}
        </div>
      </div>
      {s && (
        <div className="ml-auto flex gap-2">
          {readOnly ? null : guest && onLogin
            ? <button onClick={onLogin} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5"><Lock size={15} /> Sign in to export</button>
            : <ExportMenu data={{ pages, site, summary: s, ai, meta }} />}
          {!guest && !readOnly && <ShareButton data={{ pages, site, summary: s, ai, meta }} />}
        </div>
      )}
    </div>
  );

  if (!s) {
    // Still crawling: show pages as they arrive
    return <div ref={root}>{header}<PagesTable pages={pages} full />{busy && <p className={`mt-4 text-sm ${muted}`}>Scanning pages… the full dashboard appears when the scan finishes.</p>}</div>;
  }

  const secIssues = [
    ...s.security.checks.filter((c) => !c.ok && c.severity !== "info").map((c) => ({ t: c.name, sev: c.severity })),
    ...s.security.libIssues.map((i) => ({ t: `${i.library} ${i.version} is outdated`, sev: i.severity })),
    ...(s.security.mixedContent.length ? [{ t: `Mixed content (${s.security.mixedContent.length} http resources)`, sev: "high" }] : []),
  ].sort((a, b) => ["high", "medium", "low"].indexOf(a.sev) - ["high", "medium", "low"].indexOf(b.sev));
  const secGood = s.security.checks.filter((c) => c.ok).map((c) => ({ t: c.name, sev: "good" }));
  const palette = [...new Set([...s.palette.backgrounds.slice(0, 4).map((c) => c.value), ...s.palette.accents.slice(0, 3), ...s.palette.text.slice(0, 2).map((c) => c.value), ...s.palette.borders.slice(0, 1).map((c) => c.value)])].slice(0, 8);
  const animTags = [...s.animations.libraries.map((l) => l.name), ...s.animations.keyframes];
  const loadS = s.performance.avgLoadMs / 1000;

  return (
    <div ref={root}>
      {header}

      {view === "overview" && (
        <div className="grid gap-5">
          <AboutCard ai={ai} busy={busy} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Pages Found" value={<Num n={s.pagesAnalyzed} />} sub={s.pagesFailed ? `${s.pagesFailed} failed` : "all scanned"} subTone={s.pagesFailed ? "red" : "green"} icon={FileText} tint="violet"
              chart={<Bars values={okPages.map((p) => p.seo?.wordCount || 0)} labels={okPages.map((p) => `${pathOf(p.url)}: ${p.seo?.wordCount ?? 0} words`)} />}
              foot={<div className="flex justify-between"><span>Words per page</span><span className="font-semibold text-slate-700 dark:text-slate-200">{Math.round(okPages.reduce((t, p) => t + (p.seo?.wordCount || 0), 0) / Math.max(okPages.length, 1)).toLocaleString()} avg</span></div>} />
            {lock({ title: "Security Score", icon: Shield, teaser: "Your security score out of 100", compact: true }, <StatCard label="Security Score" value={<><Num n={s.security.score} /><span className="text-lg text-slate-400">/100</span></>} sub={scoreWord(s.security.score)} subTone={scoreTone(s.security.score)} icon={Shield} tint={s.security.score >= 80 ? "green" : s.security.score >= 50 ? "amber" : "red"}
              chart={<Ring value={s.security.score} />}
              foot={(() => { const pass = s.security.checks.filter((c) => c.ok).length, all = s.security.checks.length; return <div><div className="mb-1.5 flex justify-between"><span>Checks passed</span><span className="font-semibold text-slate-700 dark:text-slate-200">{pass}/{all}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"><div data-grow data-w={`${(pass / Math.max(all, 1)) * 100}%`} className="h-full rounded-full bg-current" style={{ width: `${(pass / Math.max(all, 1)) * 100}%` }} /></div></div>; })()} />)}
            {lock({ title: "SEO Score", icon: Search, teaser: "Your SEO score and issues found", compact: true }, <StatCard label="SEO Score" value={<><Num n={s.seoScore} /><span className="text-lg text-slate-400">/100</span></>} sub={scoreWord(s.seoScore)} subTone={scoreTone(s.seoScore)} icon={Search} tint={s.seoScore >= 80 ? "green" : s.seoScore >= 50 ? "amber" : "red"}
              chart={<Ring value={s.seoScore} />}
              foot={(() => { const clean = s.seo.pages.filter((p) => !p.issues.length).length, all = s.seo.pages.length, issues = s.seo.pages.reduce((n, p) => n + p.issues.length, 0); return <div><div className="mb-1.5 flex justify-between"><span>{issues} issues · {clean}/{all} pages clean</span><span className="font-semibold text-slate-700 dark:text-slate-200">{s.seo.hasSitemap ? "sitemap ✓" : "no sitemap"}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"><div data-grow data-w={`${(clean / Math.max(all, 1)) * 100}%`} className="h-full rounded-full bg-current" style={{ width: `${(clean / Math.max(all, 1)) * 100}%` }} /></div></div>; })()} />)}
            {lock({ title: "Load Time", icon: Gauge, teaser: "How fast each page loads", compact: true }, <StatCard label="Load Time" value={<><Num n={loadS} d={1} />s</>} sub={loadS <= 2.5 ? "Fast" : loadS <= 4 ? "Average" : "Slow"} subTone={loadS <= 2.5 ? "green" : loadS <= 4 ? "amber" : "red"} icon={Gauge} tint="blue"
              chart={<Spark values={s.performance.pages.map((p) => (p.load || p.loadMs) / 1000)} />}
              foot={(() => { const l = s.performance.pages.map((p) => (p.load || p.loadMs) / 1000); return <div className="flex justify-between"><span>Fastest <b className="text-slate-700 dark:text-slate-200">{Math.min(...l).toFixed(1)}s</b></span><span>Slowest <b className="text-slate-700 dark:text-slate-200">{Math.max(...l).toFixed(1)}s</b></span></div>; })()} />)}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Color Palette" icon={Palette} right={`${palette.length} colors detected`} onMore={() => setView("colors")}>
              <div className="grid grid-cols-4 gap-3">{palette.map((h) => <Swatch key={h} hex={h} />)}</div>
            </Card>
            <Card title="Fonts" icon={Type} right={`${s.typography.families.length} font families`} onMore={() => setView("fonts")}>
              <div className="grid gap-3 sm:grid-cols-3">
                {s.typography.families.slice(0, 3).map((f) => (
                  <div key={f.value} className="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-white/10">
                    <div style={{ fontFamily: `"${f.value}"` }} className="truncate text-2xl">Aa</div>
                    <div style={{ fontFamily: `"${f.value}"` }} className="truncate font-semibold">{f.value}</div>
                    <div className={`mt-1 truncate text-xs ${muted}`}>{weightsFor(f.value, okPages) || s.typography.weights.map((w) => w.value).slice(0, 3).join(", ")}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            {lock({ title: "Pages", icon: FileText, teaser: "Every page with its title and word count" }, <Card title="Pages" icon={FileText} right={`${okPages.length} pages`} onMore={() => setView("pages")}>
              <PagesTable pages={pages.slice(0, 6)} />
            </Card>)}
            {lock({ title: "Screenshots", icon: ImageIcon, teaser: "Desktop, tablet and phone captures" }, <Card title="Screenshots" icon={ImageIcon} onMore={() => setView("screenshots")}>
              {!okPages.some((p) => p.screenshot) ? <NoShots compact /> : <div className="grid grid-cols-2 gap-3">
                {okPages.slice(0, 4).map((p) => (
                  <button key={p.url} onClick={() => setView("screenshots")} className="min-w-0 text-left">
                    <img loading="lazy" decoding="async" src={p.screenshot} alt="" className="aspect-[4/3] w-full rounded-lg border border-slate-200 object-cover object-top dark:border-white/10" />
                    <div className={`mt-1 truncate text-xs ${muted}`}>{pathOf(p.url) === "/" ? "Home" : pathOf(p.url)}</div>
                  </button>
                ))}
              </div>}
            </Card>)}
            {lock({ title: "Security", icon: Shield, teaser: "Headers, SSL, cookies and more" }, <Card title="Security" icon={Shield} onMore={() => setView("security")}>
              <ul className="space-y-2.5">
                {[...secIssues, ...secGood].slice(0, 6).map((x) => (
                  <li key={x.t} className="flex items-center gap-3 text-sm">
                    {x.sev === "good" ? <ShieldCheck size={18} className="shrink-0 text-emerald-500" /> : x.sev === "high" ? <ShieldAlert size={18} className="shrink-0 text-red-500" /> : <AlertTriangle size={18} className="shrink-0 text-amber-500" />}
                    <span className="min-w-0 flex-1 truncate">{x.t}</span>
                    <Badge tone={x.sev === "good" ? "green" : sevTone(x.sev)}>{x.sev === "good" ? "Good" : x.sev[0].toUpperCase() + x.sev.slice(1)}</Badge>
                  </li>
                ))}
              </ul>
            </Card>)}
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card title="Animations" icon={Sparkles} right={`${animTags.length} detected`} onMore={() => setView("animations")}>
              {animTags.length ? <div className="flex flex-wrap gap-2">{animTags.slice(0, 8).map((t) => <Badge key={t}>{t}</Badge>)}{animTags.length > 8 && <button onClick={() => setView("animations")} className="rounded-full px-2 py-0.5 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300">+{animTags.length - 8} more</button>}</div> : <p className={`text-sm ${muted}`}>No keyframes or animation libraries found.</p>}
              <p className={`mt-3 text-xs ${muted}`}>{s.animations.transitionElements} elements use CSS transitions.</p>
            </Card>
            {lock({ title: "AI Suggestions", icon: Lightbulb, teaser: "Practical fixes written by AI" }, <Card title="AI Suggestions" icon={Lightbulb} onMore={() => setView("suggestions")}>
              {ai ? <SuggestionList items={ai.suggestions} limit={3} /> : <p className={`text-sm ${muted}`}>Generating…</p>}
            </Card>)}
            {lock({ title: "Design.md", icon: FileCode, teaser: "A ready-to-use design system file" }, <Card title="Design.md" icon={FileCode} onMore={() => setView("design")}>
              {ai?.designMd ? (
                <>
                  <CodePreview text={ai.designMd} lines={9} />
                  <button onClick={() => download("design.md", ai.designMd)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25"><Download size={16} /> Download design.md</button>
                </>
              ) : <p className={`text-sm ${muted}`}>{busy ? "Generating…" : "Not available."}</p>}
            </Card>)}
          </div>
        </div>
      )}

      {view === "colors" && (
        <div className="grid gap-5">
          <Card title="Background & surface colours" icon={Palette} right="by screen area"><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">{s.palette.backgrounds.map((c) => <Swatch big key={c.value} hex={c.value} label={`${c.share}% of area`} />)}</div></Card>
          <div className="grid gap-5 md:grid-cols-3">
            <Card title="Text colours"><div className="grid grid-cols-2 gap-3">{s.palette.text.map((c) => <Swatch key={c.value} hex={c.value} label={`${c.share}%`} />)}</div></Card>
            <Card title="Accent colours">{s.palette.accents.length ? <div className="grid grid-cols-2 gap-3">{s.palette.accents.map((c) => <Swatch key={c} hex={c} />)}</div> : <p className={`text-sm ${muted}`}>No strong accent colour found.</p>}</Card>
            <Card title="Border colours"><div className="grid grid-cols-2 gap-3">{s.palette.borders.map((c) => <Swatch key={c.value} hex={c.value} label={`${c.share}%`} />)}</div></Card>
          </div>
          <Card title="Contrast check" icon={Eye}>
            {(() => { const r = contrast(s.palette.primaryBg, s.palette.primaryText); return <div className="flex flex-wrap items-center gap-3 text-sm"><span className="rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10" style={{ background: s.palette.primaryBg, color: s.palette.primaryText }}>Main text on main background</span><b>{r.toFixed(2)}:1</b><Badge tone={r >= 4.5 ? "green" : "red"}>{r >= 7 ? "AAA" : r >= 4.5 ? "AA pass" : "Fails AA (needs 4.5:1)"}</Badge></div>; })()}
          </Card>
          {Object.keys(s.palette.cssVars).length > 0 && <Card title="CSS variables (:root)" right={<CopyBtn text={Object.entries(s.palette.cssVars).map(([k, v]) => `${k}: ${v};`).join("\n")} />}><pre className="max-h-72 overflow-auto rounded-xl bg-slate-50 p-4 font-mono text-xs dark:bg-black/30">{Object.entries(s.palette.cssVars).map(([k, v]) => `${k}: ${v};`).join("\n")}</pre></Card>}
        </div>
      )}

      {view === "fonts" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Font families" icon={Type}>
            {s.typography.families.map((f) => (
              <div key={f.value} className="mb-4 border-b border-slate-100 pb-4 last:border-0 dark:border-white/5">
                <div style={{ fontFamily: `"${f.value}"` }} className="text-3xl">The quick brown fox</div>
                <div className={`mt-1 text-sm ${muted}`}><b className="text-slate-700 dark:text-slate-200">{f.value}</b> · {f.share}% of text · weights {weightsFor(f.value, okPages) || "n/a"}</div>
              </div>
            ))}
          </Card>
          <Card title="Type scale" icon={Layers}>
            {s.typography.sizes.map((x) => (
              <div key={x.value} className="flex items-baseline justify-between border-b border-slate-100 py-1.5 dark:border-white/5">
                <span style={{ fontSize: Math.min(parseFloat(x.value), 48), fontFamily: `"${s.typography.families[0]?.value}"` }}>Aa</span>
                <span className={`font-mono text-xs ${muted}`}>{x.value} · {x.share}%</span>
              </div>
            ))}
            <p className={`mt-3 text-xs ${muted}`}>Weights used: {s.typography.weights.map((w) => `${w.value} (${w.share}%)`).join(", ")}</p>
            {s.typography.loadedFonts.length > 0 && <p className={`mt-1 text-xs ${muted}`}>Font files loaded: {s.typography.loadedFonts.join(", ")}</p>}
          </Card>
        </div>
      )}

      {view === "pages" && <PagesTable pages={pages} full />}

      {view === "speed" && <SpeedView pages={pages} />}
      {view === "code" && <CodeView summary={s} host={hostOf(home?.finalUrl || pages[0]?.url)} />}
      {view === "a11y" && <A11yView pages={pages} />}
      {view === "media" && <MediaView pages={pages} host={hostOf(home?.finalUrl || pages[0]?.url)} />}

      {view === "screenshots" && (
        <div className="grid gap-5">
          {!okPages.some((p) => p.screenshot) && <NoShots />}
          <ScreenshotGallery pages={pages} />
        </div>
      )}

      {view === "animations" && (
        <div className="grid gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Animation libraries" value={s.animations.libraries.length} icon={Wand2} tint="violet" />
            <StatCard label="CSS @keyframes" value={s.animations.keyframes.length} icon={Sparkles} tint="blue" />
            <StatCard label="Elements with transitions" value={s.animations.transitionElements} icon={Layers} tint="green" />
            <StatCard label="Running animations" value={s.animations.running.css + s.animations.running.transitions + s.animations.running.waapi} sub={`CSS ${s.animations.running.css} · JS ${s.animations.running.waapi}`} icon={Rocket} tint="amber" />
          </div>
          <Card title="Libraries detected" icon={Wand2}>{s.animations.libraries.length ? <div className="flex flex-wrap gap-2">{s.animations.libraries.map((l) => <Badge key={l.name} tone="violet">{l.name}{l.version ? ` ${l.version}` : ""}</Badge>)}</div> : <p className={`text-sm ${muted}`}>No animation library found. Motion (if any) is pure CSS.</p>}</Card>
          <Card title="@keyframes names" icon={Sparkles}>
            <div className="flex flex-wrap gap-2">{s.animations.keyframes.map((k) => <Badge key={k}>{k}</Badge>)}</div>
            {s.animations.blockedSheets > 0 && <p className={`mt-3 text-xs ${muted}`}>{s.animations.blockedSheets} cross-origin stylesheet(s) could not be read, so some keyframes may be missing.</p>}
          </Card>
          <Card title="Animated elements">
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className={`text-xs ${muted}`}><tr><th className="py-2">Element</th><th>Animation</th><th>Duration</th><th>Easing</th><th>Repeat</th></tr></thead>
              <tbody>{s.animations.animatedElements.map((a, i) => <tr key={i} className="border-t border-slate-100 dark:border-white/5"><td className="py-2 font-mono text-xs">{a.el}</td><td>{a.name}</td><td>{a.duration}</td><td className="text-xs">{a.timing}</td><td>{a.iteration}</td></tr>)}</tbody></table>
              {!s.animations.animatedElements.length && <p className={`text-sm ${muted}`}>No elements with running CSS animations at page load.</p>}</div>
          </Card>
          <Card title="Properties that transition"><div className="flex flex-wrap gap-2">{s.animations.transitionProps.map((k) => <Badge key={k}>{k}</Badge>)}</div></Card>
        </div>
      )}

      {view === "security" && (
        <div className="grid gap-5">
          <p className={`flex items-center gap-2 text-sm ${muted}`}><Info size={16} /> Passive checks only: we read headers, the certificate and page resources. No attacks or probing.</p>
          <Card title="Headers & HTTPS" icon={Shield} right={<Badge tone={scoreTone(s.security.score)}>Score {s.security.score}/100</Badge>}>
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {s.security.checks.map((c) => (
                <li key={c.name} className="flex items-start gap-3 py-3 text-sm">
                  {c.ok ? <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-500" /> : c.severity === "info" ? <Info size={18} className="mt-0.5 shrink-0 text-sky-500" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />}
                  <div className="min-w-0 flex-1"><div className="font-medium">{c.name}</div><div className={`break-all text-xs ${muted}`}>{c.detail}</div></div>
                  <Badge tone={c.ok ? "green" : sevTone(c.severity)}>{c.ok ? "Good" : c.severity}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Outdated / risky libraries">{s.security.libIssues.length ? s.security.libIssues.map((i) => <div key={i.library + i.version} className="mb-3 text-sm"><div className="flex items-center gap-2"><b>{i.library} {i.version}</b><Badge tone={sevTone(i.severity)}>{i.severity}</Badge></div><div className={`text-xs ${muted}`}>{i.issue}. {i.fix}.</div></div>) : <p className={`text-sm ${muted}`}>None of the version-detectable libraries are flagged.</p>}</Card>
            <Card title="Mixed content">
              {s.security.mixedContent.length ? <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-300">{s.security.mixedContent.map((m) => <li key={m} className="break-all">{m}</li>)}</ul> : <p className={`text-sm ${muted}`}>No http:// resources on https pages.</p>}
              {s.security.insecureForms.length > 0 && <p className="mt-2 text-xs text-red-600">Forms posting to http://: {s.security.insecureForms.join(", ")}</p>}
              {s.security.blankNoopener > 0 && <p className={`mt-2 text-xs ${muted}`}>{s.security.blankNoopener} target=&quot;_blank&quot; links without rel=noopener (modern browsers add it by default, low risk).</p>}
            </Card>
            <Card title="Cookies">
              {s.security.cookies.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className={`text-left text-xs ${muted}`}><tr><th className="py-1">Name</th><th>Secure</th><th>HttpOnly</th><th>SameSite</th></tr></thead><tbody>{s.security.cookies.map((c) => <tr key={c.name} className="border-t border-slate-100 dark:border-white/5"><td className="py-1.5 font-mono text-xs">{c.name}</td><td>{c.secure ? "✅" : "❌"}</td><td>{c.httpOnly ? "✅" : "—"}</td><td className="text-xs">{c.sameSite}</td></tr>)}</tbody></table></div> : <p className={`text-sm ${muted}`}>No cookies set.</p>}
            </Card>
            <Card title="Third-party domains"><div className="flex flex-wrap gap-2">{s.security.thirdPartyDomains.map((d) => <Badge key={d}>{d}</Badge>)}</div></Card>
          </div>
          {s.security.ssl && (
            <Card title="SSL certificate" icon={ShieldCheck}>
              <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                {(["valid", "issuer", "protocol", "daysLeft", "validFrom", "validTo", "subject"] as const).map((k) => <div key={k}><dt className={`text-xs ${muted}`}>{k}</dt><dd className="break-all">{String(s.security.ssl![k] ?? "—")}</dd></div>)}
              </dl>
            </Card>
          )}
          <Card title="SEO & links" icon={Search} right={<Badge tone={scoreTone(s.seoScore)}>SEO {s.seoScore}/100</Badge>}>
            <div className="mb-4 flex flex-wrap gap-2 text-xs"><Badge tone={s.seo.hasSitemap ? "green" : "amber"}>sitemap.xml {s.seo.hasSitemap ? "found" : "missing"}</Badge><Badge tone={s.seo.hasRobots ? "green" : "amber"}>robots.txt {s.seo.hasRobots ? "found" : "missing"}</Badge><Badge tone={s.brokenLinks.length ? "red" : "green"}>{s.brokenLinks.length} broken of {s.linksChecked} links</Badge>{s.linksBlocked > 0 && <Badge tone="slate">{s.linksBlocked} blocked bots (401/403/429), not counted</Badge>}</div>
            {s.brokenLinks.length > 0 && <ul className="mb-4 space-y-1 text-xs">{s.brokenLinks.map((b) => <li key={b.url} className="flex gap-2"><Badge tone="red">{b.status ?? "error"}</Badge><a href={b.url} target="_blank" rel="noreferrer" className="break-all hover:underline">{b.url}</a></li>)}</ul>}
            {s.seo.pages.map((p) => <div key={p.url} className="mb-3"><div className="truncate text-sm font-medium">{pathOf(p.url)}</div>{p.issues.length ? <ul className={`ml-4 list-disc text-xs ${muted}`}>{p.issues.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="text-xs text-emerald-600">No issues</p>}</div>)}
          </Card>
        </div>
      )}

      {view === "suggestions" && (
        <Card title={ai?.ai ? `AI Suggestions (${ai.model})` : "Suggestions"} icon={Lightbulb}>
          {ai?.note && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{ai.note}</p>}
          {ai?.error && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">AI note: {ai.error}</p>}
          {ai ? <SuggestionList items={ai.suggestions} /> : <p className={`text-sm ${muted}`}>Generating…</p>}
        </Card>
      )}

      {view === "design" && (
        <Card title={`design.md ${ai?.ai ? `· written by ${ai.model}` : "· auto-generated"}`} icon={FileCode}
          right={ai?.designMd && <div className="flex gap-2"><CopyBtn text={ai.designMd} /><button onClick={() => download("design.md", ai.designMd)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1.5 text-xs font-semibold text-white"><Download size={14} /> Download</button></div>}>
          {ai?.designMd ? <CodePreview text={ai.designMd} /> : <p className={`text-sm ${muted}`}>{busy ? "Generating…" : "Not available."}</p>}
        </Card>
      )}

      {view === "tech" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Front-end" icon={Layers}>{s.tech.length ? <div className="flex flex-wrap gap-2">{s.tech.map((t) => <Badge key={t.name} tone="violet">{t.name}{t.version ? ` ${t.version}` : ""}</Badge>)}</div> : <p className={`text-sm ${muted}`}>Nothing detected.</p>}</Card>
          <Card title="Hosting / server" icon={Globe}>{s.hosting.length ? <div className="flex flex-wrap gap-2">{s.hosting.map((h) => <Badge key={h} tone="blue">{h}</Badge>)}</div> : <p className={`text-sm ${muted}`}>No hints in headers.</p>}</Card>
          <Card title="Performance by page" icon={Gauge} className="lg:col-span-2">
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className={`text-left text-xs ${muted}`}><tr><th className="py-2">Page</th><th>TTFB</th><th>DOM ready</th><th>Load</th><th>Requests</th><th>Size</th><th>DOM nodes</th></tr></thead>
              <tbody>{s.performance.pages.map((p) => <tr key={p.url} className="border-t border-slate-100 dark:border-white/5"><td className="max-w-xs truncate py-2">{pathOf(p.url)}</td><td>{p.ttfb}ms</td><td>{p.domContentLoaded}ms</td><td>{p.load}ms</td><td>{p.requests}</td><td>{p.transferKB} KB</td><td>{p.domNodes}</td></tr>)}</tbody></table></div>
          </Card>
          {site?.headers && <Card title="Response headers" className="lg:col-span-2"><pre className="max-h-80 overflow-auto rounded-xl bg-slate-50 p-4 font-mono text-xs dark:bg-black/30">{Object.entries(site.headers).map(([k, v]) => `${k}: ${v}`).join("\n")}</pre></Card>}
        </div>
      )}
    </div>
  );
}

/** Site icon: tries each source, falls back to a globe if none loads. */
function Favicon({ srcs, host }: { srcs: string[]; host: string }) {
  const [i, setI] = useState(0);
  // no logo found: the site's first letter on the brand gradient (instead of a plain globe)
  if (i >= srcs.length) return <span className="grid h-full w-full place-items-center bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-bold uppercase text-white">{host.replace(/^www\./, "")[0] || "?"}</span>;
  return <img src={srcs[i]} alt="" className="h-8 w-8 object-contain" onError={() => setI((x) => x + 1)} />;
}

/** "About this website": one line when closed, full AI description when expanded. */
function AboutCard({ ai, busy }: { ai: AiResult | null; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const a = ai?.about;
  return (
    <section data-anim="card" className={`${card} overflow-hidden`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-5 text-left" aria-expanded={open}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25"><Info size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-semibold"><span className="whitespace-nowrap">About this website</span> {a?.whatItIs && <span className="max-w-full truncate rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{a.whatItIs}</span>}</div>
          <div className={`text-sm ${muted} ${open ? "" : "line-clamp-1"}`}>{a ? a.summary : busy ? "The AI is reading the website…" : "Not available."}</div>
        </div>
        <ChevronDown size={20} className={`shrink-0 text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ${open && a ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          {a && (
            <div className="grid gap-4 border-t border-slate-100 p-5 text-sm sm:grid-cols-2 dark:border-white/5">
              <div><div className={`mb-1 text-xs font-semibold uppercase tracking-wide ${muted}`}>Who it&apos;s for</div>{a.audience}</div>
              <div><div className={`mb-1 text-xs font-semibold uppercase tracking-wide ${muted}`}>Brand tone</div>{a.tone}</div>
              <div><div className={`mb-1 text-xs font-semibold uppercase tracking-wide ${muted}`}>Main action for visitors</div>{a.mainAction}</div>
              {a.offerings?.length > 0 && <div><div className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${muted}`}>What it offers</div><div className="flex flex-wrap gap-1.5">{a.offerings.map((o) => <Badge key={o} tone="blue">{o}</Badge>)}</div></div>}
              {a.sections?.length > 0 && <div className="sm:col-span-2"><div className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${muted}`}>Main sections</div><div className="flex flex-wrap gap-1.5">{a.sections.map((o) => <Badge key={o}>{o}</Badge>)}</div></div>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Number that GSAP counts up from 0. */
const Num = ({ n, d = 0 }: { n: number; d?: number }) => <span data-count={n} data-dec={d}>{n.toFixed(d)}</span>;

function weightsFor(family: string, pages: PageResult[]) {
  const w = new Set<string>();
  pages.forEach((p) => p.typography?.loadedFonts.forEach((f) => { if (f.toLowerCase().startsWith(family.toLowerCase() + " ")) w.add(f.slice(family.length + 1)); }));
  return [...w].slice(0, 5).join(", ");
}

function CodePreview({ text, lines }: { text: string; lines?: number }) {
  const all = text.split("\n");
  const shown = lines ? all.slice(0, lines) : all;
  return (
    <div className={`overflow-auto rounded-xl bg-slate-50 py-3 font-mono text-xs leading-relaxed dark:bg-black/30 ${lines ? "" : "max-h-[70vh]"}`}>
      {shown.map((l, i) => (
        <div key={i} className="flex">
          <span className="w-10 shrink-0 select-none pr-3 text-right text-slate-400">{i + 1}</span>
          <span className={`whitespace-pre-wrap break-all pr-3 ${l.startsWith("#") ? "font-semibold text-indigo-600 dark:text-indigo-300" : ""}`}>{l || " "}</span>
        </div>
      ))}
    </div>
  );
}

function PagesTable({ pages, full }: { pages: PageResult[]; full?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const table = (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className={`text-xs ${muted}`}><tr><th className="py-2 pr-3">URL</th>{full && <th className="pr-3">Title</th>}<th className="pr-3">Words</th><th>Status</th></tr></thead>
        <tbody>
          {pages.map((p) => (
            <tr key={p.url} onClick={() => full && setOpen(open === p.url ? null : p.url)} className={`border-t border-slate-100 dark:border-white/5 ${full ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5" : ""}`}>
              <td className="max-w-[220px] py-2.5 pr-3"><span className="flex items-center gap-1.5"><Link2 size={14} className="shrink-0 text-indigo-500" /><span className="truncate">{pathOf(p.url)}</span></span></td>
              {full && <td className="max-w-[280px] truncate pr-3">{p.seo?.title || "—"}</td>}
              <td className="pr-3">{p.seo?.wordCount?.toLocaleString() ?? "—"}</td>
              <td title={p.error || (p.lite ? "Heavy page: scanned with a lighter scan (no tablet/phone screenshots or accessibility check)" : undefined)}>{p.error ? <Badge tone="red">Error</Badge> : <span className="inline-flex items-center gap-1"><Badge tone={p.status && p.status < 400 ? "green" : "amber"}>{p.status ?? "OK"}</Badge>{p.lite && <Badge tone="amber">Lite</Badge>}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  if (!full) return table;
  const sel = pages.find((p) => p.url === open);
  return (
    <div className="grid gap-5">
      <Card title="All pages" icon={FileText} right="Click a row for details">{table}</Card>
      {sel && <PageDetail p={sel} />}
    </div>
  );
}

function PageDetail({ p }: { p: PageResult }) {
  if (p.error) return <Card title={pathOf(p.url)}><p className="text-sm text-red-600">{p.error}</p></Card>;
  const seo = p.seo!;
  const row = (k: string, v: React.ReactNode) => <div><div className={`text-xs ${muted}`}>{k}</div><div className="text-sm">{v || "—"}</div></div>;
  return (
    <Card title={seo.title || pathOf(p.url)} icon={FileText} right={<a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">Open <ExternalLink size={12} /></a>}>
      <div className="grid gap-5 lg:grid-cols-2">
        {p.screenshot ? <img loading="lazy" decoding="async" src={p.screenshot} alt="page screenshot" className="max-h-[640px] w-full rounded-xl border border-slate-200 object-cover object-top dark:border-white/10" /> : <NoShots compact />}
        <div className="space-y-3">
          {row("Description", seo.description)}
          {row("H1", seo.h1.join(" | "))}
          {row("H2", <span className="text-xs">{seo.h2.slice(0, 8).join(" | ")}</span>)}
          <div className="grid grid-cols-3 gap-3">
            {row("Words", seo.wordCount)}{row("Images", `${seo.images} (${seo.imagesNoAlt} no alt)`)}{row("Links", p.links?.length)}
            {row("Load", `${p.perf?.load}ms`)}{row("Requests", p.perf?.requests)}{row("Size", `${p.perf?.transferKB} KB`)}
          </div>
          {row("Colours", <div className="mt-1 flex flex-wrap gap-1">{[...(p.colors?.background || []), ...(p.colors?.text || [])].slice(0, 14).map(([h]) => <span key={h} title={h} className="h-6 w-6 rounded-md border border-slate-200 dark:border-white/10" style={{ background: h }} />)}</div>)}
          {row("Fonts", p.typography?.families.map(([f]) => f).join(", "))}
          {row("Structured data", seo.jsonLd.join(", ") || "none")}
          {row("Social preview", `${seo.ogTitle ? `og:title "${seo.ogTitle}"` : "no og:title"} · ${seo.ogImage ? "has og:image" : "no og:image"}`)}
          {row("Animations", [...(p.animations?.libraries.map((l) => l.name) || []), ...(p.animations?.keyframes || [])].slice(0, 10).join(", "))}
        </div>
      </div>
    </Card>
  );
}

function SuggestionList({ items, limit }: { items: AiResult["suggestions"]; limit?: number }) {
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const icon: Record<string, [React.ElementType, string]> = {
    Security: [Shield, "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300"],
    SEO: [Search, "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"],
    Performance: [Gauge, "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"],
    Design: [Palette, "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"],
    Accessibility: [Eye, "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"],
  };
  const list = [...items].sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3)).slice(0, limit ?? items.length);
  if (!list.length) return <p className={`text-sm ${muted}`}>No suggestions.</p>;
  return (
    <ul className="space-y-3">
      {list.map((x, i) => {
        const [Icon, cls] = icon[x.area] || [Lightbulb, "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"];
        return (
          <li key={i} data-row className="flex gap-3">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${cls}`}><Icon size={18} /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium">{x.title}{!limit && <Badge tone={sevTone(x.priority)}>{x.priority}</Badge>}</div>
              <div className={`text-xs ${muted} ${limit ? "line-clamp-2" : ""}`}>{x.detail}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Empty() {
  const items = [
    [Palette, "Colours & fonts", "Exact palette, type scale and loaded font files"],
    [ImageIcon, "Screenshots", "Desktop and mobile captures of every page"],
    [Sparkles, "Animations", "CSS keyframes, transitions, GSAP and more"],
    [Shield, "Security", "Passive checks: headers, SSL, outdated libraries"],
    [Search, "SEO & links", "Meta tags, headings and broken links"],
    [FileCode, "design.md", "A ready-to-use design system file, written by AI"],
  ] as const;
  return (
    <div className="mx-auto max-w-4xl py-10 text-center">
      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-xl shadow-indigo-500/30"><Sparkles size={28} /></div>
      <h1 className="text-3xl font-bold tracking-tight">Analyze any website</h1>
      <p className={`mt-2 ${muted}`}>Paste a URL above and press Analyze.</p>
      <div className="mt-10 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([Icon, t, d]) => (
          <div key={t} className={`${card} p-5`}><Icon size={20} className="text-indigo-500" /><div className="mt-2 font-semibold">{t}</div><div className={`text-sm ${muted}`}>{d}</div></div>
        ))}
      </div>
    </div>
  );
}
