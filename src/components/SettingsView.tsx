"use client";

import { Settings as SettingsIcon, Palette, Sun, Moon, Monitor, Sparkles, Image as ImageIcon, Wand2, Gauge, RotateCcw, Check } from "lucide-react";
import type { Settings } from "@/lib/settings";

const card = "glass-panel rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]";
const muted = "text-slate-500 dark:text-slate-400";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-gradient-to-r from-indigo-500 to-violet-500" : "bg-slate-300 dark:bg-white/15"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

function Row({ icon: Icon, title, desc, children }: { icon: React.ElementType; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 py-4 last:border-0 dark:border-white/5">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><Icon size={18} /></div>
      <div className="min-w-0 flex-1"><div className="font-medium">{title}</div><div className={`text-xs ${muted}`}>{desc}</div></div>
      <div className="ml-auto">{children}</div>
    </div>
  );
}

export default function SettingsView({ settings: s, update, reset, hasSite }: { settings: Settings; update: (p: Partial<Settings>) => void; reset: () => void; hasSite: boolean }) {
  const themes = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <h2 className="flex items-center gap-2 text-xl font-bold"><SettingsIcon size={22} className="text-indigo-500" /> Settings</h2>

      <section data-anim="card" className={card}>
        <h3 className="mb-1 font-semibold">Appearance</h3>
        <p className={`mb-4 text-xs ${muted}`}>Saved in this browser.</p>

        <div className="grid grid-cols-3 gap-3">
          {themes.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => update({ theme: id })}
              className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition ${s.theme === id ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" : "border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"}`}>
              {s.theme === id && <Check size={14} className="absolute right-2 top-2" />}
              <Icon size={20} /> {label}
            </button>
          ))}
        </div>

        {/* Glass mode preview card */}
        <div
          className={`mt-4 flex w-full items-center gap-4 overflow-hidden rounded-xl border p-4 text-left transition ${s.glass ? "border-indigo-400" : "border-slate-200 dark:border-white/10"}`}
          style={{ background: "radial-gradient(circle at 15% 30%, #a78bfa88, transparent 45%), radial-gradient(circle at 85% 70%, #38bdf888, transparent 45%), radial-gradient(circle at 50% 120%, #f472b688, transparent 50%)" }}>
          <div className="rounded-xl border border-white/40 bg-white/30 px-4 py-3 shadow-lg backdrop-blur-md dark:bg-black/20">
            <Sparkles size={18} className="text-white drop-shadow" />
          </div>
          <div className="flex-1 text-slate-900 dark:text-white">
            <div className="font-semibold">Glass mode</div>
            <div className="text-xs opacity-80">Frosted, see-through panels (glassmorphism). Works with light and dark.</div>
          </div>
          <Toggle on={s.glass} onChange={(v) => update({ glass: v })} label="Glass mode" />
        </div>
      </section>

      <section data-anim="card" className={`${card} ${s.glass ? "" : "opacity-60"}`}>
        <h3 className="mb-1 font-semibold">Glass background</h3>
        <p className={`mb-2 text-xs ${muted}`}>{s.glass ? "Shown behind the glass panels." : "Turn on Glass mode to use these."}</p>
        <Row icon={ImageIcon} title="Use the analysed website as background" desc={`Shows the site's landing page (homepage screenshot) behind the glass.${hasSite ? "" : " Analyse a site to see it."}`}>
          <Toggle on={s.siteBackground} onChange={(v) => update({ siteBackground: v })} label="Site background" />
        </Row>
        <Row icon={Palette} title="Match the website's theme" desc="Dashboard takes the site's colours and light/dark look. Text always stays readable.">
          <Toggle on={s.siteTheme} onChange={(v) => update({ siteTheme: v })} label="Match site theme" />
        </Row>
        <Row icon={Wand2} title={`Background blur: ${s.bgBlur}px`} desc="0 = sharp screenshot. Higher = softer.">
          <input type="range" min={0} max={40} value={s.bgBlur} onChange={(e) => update({ bgBlur: +e.target.value })} className="w-40 accent-indigo-500" aria-label="Background blur" />
        </Row>
        <Row icon={Sparkles} title={`Background strength: ${s.bgStrength}%`} desc="How strongly the background shows through.">
          <input type="range" min={10} max={100} value={s.bgStrength} onChange={(e) => update({ bgStrength: +e.target.value })} className="w-40 accent-indigo-500" aria-label="Background strength" />
        </Row>
      </section>

      <section data-anim="card" className={card}>
        <h3 className="mb-1 font-semibold">Analysis & motion</h3>
        <Row icon={Gauge} title={`Default pages to crawl: ${s.defaultPages}`} desc="Used when the app opens. You can still change it in the top bar.">
          <input type="range" min={1} max={30} value={s.defaultPages} onChange={(e) => update({ defaultPages: +e.target.value })} className="w-40 accent-indigo-500" aria-label="Default pages" />
        </Row>
        <Row icon={Sparkles} title="Animations" desc="GSAP animations on cards, charts and numbers.">
          <Toggle on={s.motion} onChange={(v) => update({ motion: v })} label="Animations" />
        </Row>
      </section>

      <div>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"><RotateCcw size={14} /> Reset to defaults</button>
      </div>
    </div>
  );
}
