"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

type Step = { target?: string; title: string; text: string };

/** Steps point at elements marked with data-tour="…". Missing targets show the card in the centre. */
const STEPS: Step[] = [
  { title: "Welcome to Scrapper AI 👋", text: "A 30-second tour of the main things you can do. You can skip it any time." },
  { target: "search", title: "Paste a website link", text: "Paste any URL here. The scan starts by itself and asks how many pages you want." },
  { target: "nav", title: "Explore the results", text: "Results are grouped into Design, Content, Audit and Account. Click a group to open it." },
  { target: "glass", title: "Glass mode", text: "Turns the dashboard into frosted glass, with the analysed site shown behind it." },
  { target: "theme", title: "Light or dark", text: "Switch between light and dark at any time." },
  { target: "account", title: "Your account", text: "Your history, plans and log out live here. Every analysis is saved for you." },
  { target: "settings", title: "Settings and this tour", text: "Change the theme, animations and defaults here. You can replay this tour from Settings." },
];

export default function Tour({ open, onClose: done }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const onClose = useCallback(() => { setI(0); done(); }, [done]); // next time the tour starts from step 1
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[i];

  const measure = useCallback(() => {
    const el = step.target ? (document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null) : null;
    const r = el?.getBoundingClientRect();
    setRect(r && r.width > 0 && r.height > 0 ? r : null);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [step.target]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(measure); // measure after layout
    return () => cancelAnimationFrame(id);
  }, [open, i, measure]);
  useEffect(() => {
    if (!open) return;
    const on = () => measure();
    window.addEventListener("resize", on);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, STEPS.length - 1)); if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1)); };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("keydown", key); };
  }, [open, measure, onClose]);

  if (!open || typeof document === "undefined") return null;
  const pad = 8;
  const last = i === STEPS.length - 1;
  // place the card below the target if there is room, else above; centred when there is no target
  const cardW = 320;
  const cardH = 190, W = window.innerWidth, H = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(12, x), W - cardW - 12);
  const clampY = (y: number) => Math.min(Math.max(12, y), H - cardH - 12);
  let pos: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%,-50%)" };
  if (rect) {
    const cx = clampX(rect.left + rect.width / 2 - cardW / 2);
    if (rect.bottom + 16 + cardH < H) pos = { left: cx, top: rect.bottom + 16 };
    else if (rect.top - 16 - cardH > 0) pos = { left: cx, top: rect.top - 16 - cardH };
    else if (rect.right + 16 + cardW < W) pos = { left: rect.right + 16, top: clampY(rect.top + 40) }; // tall targets like the sidebar
    else pos = { left: clampX(rect.left - 16 - cardW), top: clampY(rect.top + 40) };
  }

  return createPortal(
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal aria-label="Quick tour">
      {/* dim everything except the highlighted element */}
      {rect ? (
        <div className="pointer-events-none fixed rounded-2xl ring-2 ring-indigo-400 transition-all duration-300"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(8,8,20,.62)" }} />
      ) : <div className="fixed inset-0 bg-[rgba(8,8,20,.62)]" />}
      <div className="fixed rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl transition-all duration-300 dark:border-white/10 dark:bg-[#1b1b30]" style={{ width: cardW, ...pos }}>
        <div className="flex items-start gap-2">
          <h3 className="flex-1 font-bold">{step.title}</h3>
          <button onClick={onClose} aria-label="Close tour" className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{step.text}</p>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 gap-1">{STEPS.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-indigo-500" : "w-1.5 bg-slate-300 dark:bg-white/20"}`} />)}</div>
          {i > 0 && <button onClick={() => setI(i - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-white/10" aria-label="Back"><ArrowLeft size={15} /></button>}
          <button onClick={() => (last ? onClose() : setI(i + 1))} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1.5 text-sm font-semibold text-white">
            {last ? "Done" : i === 0 ? "Start" : "Next"} {!last && <ArrowRight size={15} />}
          </button>
        </div>
        {i === 0 && <button onClick={onClose} className="mt-3 text-xs text-slate-400 hover:underline">Skip tour</button>}
      </div>
    </div>,
    document.body
  );
}
