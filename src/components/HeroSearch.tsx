"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Link2, Palette, Image as ImageIcon, Layers, ShieldCheck, Link as LinkIcon, Code2, ArrowRight } from "lucide-react";
import type { View } from "@/components/Dashboard";

gsap.registerPlugin(useGSAP);

/** Feature cards. Each opens its section (right away after a scan, or once the next scan starts). */
type Feature = { icon: React.ElementType; title: string; desc: string; view: View; tone: string };
const FEATURES: Feature[] = [
  { icon: Palette, title: "Colours & fonts", desc: "Exact palette, type scale and loaded font files", view: "colors", tone: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" },
  { icon: ImageIcon, title: "Screenshots & media", desc: "Desktop, tablet and mobile captures, plus every image and video", view: "screenshots", tone: "bg-sky-100 text-blue-600 dark:bg-sky-500/15 dark:text-sky-300" },
  { icon: Layers, title: "Animations", desc: "CSS keyframes, transitions, GSAP and more", view: "animations", tone: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" },
  { icon: ShieldCheck, title: "Security & speed", desc: "Passive security checks, Core Web Vitals and accessibility", view: "security", tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { icon: LinkIcon, title: "SEO & links", desc: "Meta tags, headings and broken links", view: "pages", tone: "bg-orange-100 text-orange-500 dark:bg-orange-500/15 dark:text-orange-300" },
  { icon: Code2, title: "design.md & code", desc: "A design system file, design tokens and React components", view: "design", tone: "bg-sky-100 text-blue-600 dark:bg-sky-500/15 dark:text-sky-300" },
];

const looksLikeUrl = (s: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(s.trim());
const reduced = () => typeof document !== "undefined" && (document.documentElement.classList.contains("no-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches);

/** Big centred URL box on the start page. Pasting a link (or pressing Analyze) plays an exit animation, then starts the scan. */
export default function HeroSearch({ url, setUrl, onStart, target, onPick }: {
  url: string; setUrl: (v: string) => void; onStart: (url: string) => void;
  /** section picked from a card, opened when the scan starts */ target?: View | null; onPick?: (v: View) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [leaving, setLeaving] = useState(false);
  const picked = FEATURES.find((f) => f.view === target);

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
      .to(q("[data-h=box]"), { scale: 1, boxShadow: "0 0 0 6px rgba(139,92,246,.35), 0 20px 60px -10px rgba(139,92,246,.6)", duration: 0.25 })
      .to(q("[data-h=card]"), { y: 40, opacity: 0, stagger: { each: 0.04, from: "center" }, duration: 0.35, ease: "power2.in" }, "<")
      .to(q("[data-h=title] > *, [data-h=logo]"), { y: -30, opacity: 0, stagger: 0.05, duration: 0.35, ease: "power2.in" }, "<0.05")
      .to(q("[data-h=box]"), { y: -60, opacity: 0, scale: 0.9, duration: 0.4, ease: "power3.in" }, "-=0.1");
  }

  return (
    <div ref={root} className="relative mx-auto flex min-h-[calc(100vh-140px)] max-w-6xl flex-col items-center justify-center py-6 text-center sm:py-8">
      {/* soft background waves, like the mockup */}
      <svg viewBox="0 0 1200 800" preserveAspectRatio="none" className="pointer-events-none absolute -inset-x-24 -top-10 -z-10 h-[110%] w-[calc(100%+12rem)] text-violet-400/15 dark:text-violet-500/10" aria-hidden>
        <path d="M0 0 H520 C 380 120, 300 260, 120 360 C 60 395, 20 420, 0 430 Z" fill="currentColor" />
        <path d="M1200 420 C 1080 520, 980 560, 860 640 C 800 690, 770 740, 760 800 H1200 Z" fill="currentColor" />
      </svg>
      <div data-h="logo" className="mb-6 grid h-20 w-20 place-items-center rounded-[1.4rem] bg-gradient-to-br from-violet-500 to-violet-700 shadow-xl shadow-violet-500/30 sm:h-24 sm:w-24">
        <svg viewBox="0 0 48 48" className="h-11 w-11 sm:h-14 sm:w-14" fill="none" aria-hidden>
          <rect x="5" y="8" width="38" height="30" rx="6" fill="#fff" fillOpacity=".95" />
          <rect x="5" y="8" width="38" height="8" rx="4" fill="#ddd6fe" />
          <circle cx="31" cy="12" r="1.3" fill="#7c3aed" /><circle cx="35" cy="12" r="1.3" fill="#7c3aed" /><circle cx="39" cy="12" r="1.3" fill="#7c3aed" />
          <path d="M12 21v6M9 24h6" stroke="#7c3aed" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="28" cy="28" r="6.5" stroke="#6d28d9" strokeWidth="3" />
          <path d="M33 33l5 5" stroke="#6d28d9" strokeWidth="3.4" strokeLinecap="round" />
        </svg>
      </div>
      <div data-h="title">
        <h1 className="text-4xl font-extrabold tracking-tight text-[#14123a] dark:text-white sm:text-5xl lg:text-6xl">
          Analyze any{" "}
          <span className="relative inline-block bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent dark:from-violet-300 dark:to-fuchsia-300">
            website
            <svg viewBox="0 0 200 14" preserveAspectRatio="none" className="absolute -bottom-2 left-[8%] h-2.5 w-[84%] text-violet-500 dark:text-violet-300" aria-hidden>
              <path d="M3 10 C 60 1, 140 1, 197 7" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="mt-4 text-base text-slate-600 dark:text-slate-300 sm:text-lg">Paste a link below. The scan starts as soon as you paste.</p>
      </div>

      <form data-tour="search" onSubmit={(e) => { e.preventDefault(); go(url); }} className="relative mt-9 w-full max-w-3xl">
        <div data-h="glow" className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-r from-violet-500/25 via-purple-400/25 to-indigo-400/25 opacity-50 blur-2xl" />
        <div data-h="box" className="glass-panel relative flex items-center gap-2 rounded-2xl border border-violet-200 bg-white p-2 pl-4 shadow-xl shadow-violet-500/10 focus-within:border-violet-400 dark:border-white/10 dark:bg-[#16162a] sm:gap-3 sm:p-2.5 sm:pl-6">
          <Link2 size={24} className="shrink-0 text-violet-600 dark:text-violet-300" />
          <input ref={input} autoFocus value={url} onChange={(e) => setUrl(e.target.value)} disabled={leaving}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); if (looksLikeUrl(t)) { e.preventDefault(); setUrl(t.trim()); go(t); } }}
            placeholder="https://example.com" aria-label="Website URL"
            className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none placeholder:text-slate-400 sm:text-xl" />
          <button disabled={!url.trim() || leaving} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-violet-700 px-4 py-3.5 text-base font-semibold text-white shadow-[0_10px_24px_-8px_rgba(124,58,237,0.45)] transition hover:brightness-110 disabled:cursor-not-allowed sm:px-7">
            <span className="hidden sm:inline">Analyze</span> <ArrowRight size={20} />
          </button>
        </div>
      </form>
      <p className={`mt-3 h-5 text-sm text-violet-600 transition-opacity dark:text-violet-300 ${picked ? "opacity-100" : "opacity-0"}`} aria-live="polite">
        {picked && <>Paste a link and we&apos;ll open <b>{picked.title}</b> as soon as the scan starts.</>}
      </p>

      <div className="mt-8 grid w-full gap-4 text-left sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {FEATURES.map(({ icon: Icon, title, desc, view, tone }) => (
          <button key={title} type="button" data-h="card" onClick={() => { onPick?.(view); input.current?.focus(); }}
            className={`glass-panel group flex items-center gap-4 rounded-2xl border bg-white p-5 text-left shadow-[0_6px_24px_-12px_rgba(91,33,182,0.25)] transition-[box-shadow,border-color] hover:border-violet-300 hover:shadow-[0_12px_32px_-12px_rgba(91,33,182,0.35)] dark:bg-[#16162a] dark:hover:border-violet-400/40 sm:p-6 ${target === view ? "border-violet-400 ring-2 ring-violet-400/30" : "border-slate-200/80 dark:border-white/10"}`}>
            <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${tone}`}><Icon size={28} strokeWidth={1.8} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold text-[#14123a] dark:text-white">{title}</span>
              <span className="mt-1 block text-sm leading-snug text-slate-500 dark:text-slate-400">{desc}</span>
            </span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-600 transition group-hover:bg-violet-600 group-hover:text-white dark:bg-white/5 dark:text-slate-300"><ArrowRight size={18} /></span>
          </button>
        ))}
      </div>
    </div>
  );
}
