"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Link2, Sparkles, Palette, Image as ImageIcon, Shield, Search, FileCode, Wand2, ArrowRight } from "lucide-react";

gsap.registerPlugin(useGSAP);

const FEATURES = [
  [Palette, "Colours & fonts", "Exact palette, type scale and loaded font files"],
  [ImageIcon, "Screenshots & media", "Desktop, tablet and mobile captures, plus every image and video"],
  [Wand2, "Animations", "CSS keyframes, transitions, GSAP and more"],
  [Shield, "Security & speed", "Passive security checks, Core Web Vitals and accessibility"],
  [Search, "SEO & links", "Meta tags, headings and broken links"],
  [FileCode, "design.md & code", "A design system file, design tokens and React components"],
] as const;

const looksLikeUrl = (s: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(s.trim());
const reduced = () => typeof document !== "undefined" && (document.documentElement.classList.contains("no-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches);

/** Big centred URL box on the start page. Pasting a link (or pressing Analyze) plays an exit animation, then starts the scan. */
export default function HeroSearch({ url, setUrl, onStart }: { url: string; setUrl: (v: string) => void; onStart: (url: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);

  // entrance: logo pops, title rises, search box grows in, cards stagger up
  useGSAP(() => {
    if (reduced()) return;
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from("[data-h=logo]", { scale: 0.5, opacity: 0, rotate: -12, duration: 0.6, ease: "back.out(2)" })
      .from("[data-h=title] > *", { y: 24, opacity: 0, stagger: 0.08, duration: 0.6 }, "-=0.3")
      .from("[data-h=box]", { y: 20, scale: 0.96, opacity: 0, duration: 0.6 }, "-=0.35")
      .from("[data-h=card]", { y: 30, opacity: 0, stagger: 0.06, duration: 0.5 }, "-=0.3");
    // gentle breathing glow behind the search box
    gsap.to("[data-h=glow]", { opacity: 0.9, scale: 1.05, duration: 2.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
  }, { scope: root });

  function go(raw: string) {
    const u = raw.trim();
    if (!u || leaving) return;
    setLeaving(true);
    if (reduced()) { onStart(u); return; }
    const q = gsap.utils.selector(root);
    gsap.timeline({ onComplete: () => onStart(u) })
      .to(q("[data-h=box]"), { scale: 1.04, duration: 0.18, ease: "power2.out" })
      .to(q("[data-h=box]"), { scale: 1, boxShadow: "0 0 0 6px rgba(99,102,241,.35), 0 20px 60px -10px rgba(99,102,241,.6)", duration: 0.25 })
      .to(q("[data-h=card]"), { y: 40, opacity: 0, stagger: { each: 0.04, from: "center" }, duration: 0.35, ease: "power2.in" }, "<")
      .to(q("[data-h=title] > *, [data-h=logo]"), { y: -30, opacity: 0, stagger: 0.05, duration: 0.35, ease: "power2.in" }, "<0.05")
      .to(q("[data-h=box]"), { y: -60, opacity: 0, scale: 0.9, duration: 0.4, ease: "power3.in" }, "-=0.1");
  }

  return (
    <div ref={root} className="mx-auto flex min-h-[calc(100vh-140px)] max-w-4xl flex-col items-center justify-center py-8 text-center">
      <div data-h="logo" className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-xl shadow-indigo-500/30"><Sparkles size={28} /></div>
      <div data-h="title">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Analyze any website</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Paste a link below. The scan starts as soon as you paste.</p>
      </div>

      <form data-tour="search" onSubmit={(e) => { e.preventDefault(); go(url); }} className="relative mt-8 w-full max-w-2xl">
        <div data-h="glow" className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-r from-indigo-500/30 via-violet-500/30 to-sky-500/30 opacity-50 blur-2xl" />
        <div data-h="box" className="relative flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 pl-4 shadow-xl shadow-indigo-500/10 focus-within:border-indigo-400 dark:border-white/10 dark:bg-[#16162a]">
          <Link2 size={20} className="shrink-0 text-indigo-500" />
          <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} disabled={leaving}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); if (looksLikeUrl(t)) { e.preventDefault(); setUrl(t.trim()); go(t); } }}
            placeholder="https://example.com" aria-label="Website URL"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none placeholder:text-slate-400 sm:text-lg" />
          <button disabled={!url.trim() || leaving} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50 sm:px-6">
            <span className="hidden sm:inline">Analyze</span> <ArrowRight size={18} />
          </button>
        </div>
      </form>

      <div className="mt-12 grid w-full gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([Icon, t, d]) => (
          <div key={t} data-h="card" className="glass-panel rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]">
            <Icon size={20} className="text-indigo-500" />
            <div className="mt-2 font-semibold">{t}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
