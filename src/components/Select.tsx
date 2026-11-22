"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type Option = { value: string; label: string };
type Props = {
  value: string; onChange: (value: string) => void; options: Option[]; placeholder?: string; ariaLabel?: string;
  size?: "md" | "sm"; disabled?: boolean; className?: string;
};

/**
 * Dropdown that matches the app (light, dark and glass). The browser's own <select> list can't be styled and shows
 * white text on white in dark mode, so this draws the list itself. The list is a portal, so tables never clip it.
 */
export default function Select({ value, onChange, options, placeholder = "Choose…", ariaLabel, size = "md", disabled, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean }>({ left: 0, top: 0, width: 0, up: false });
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);

  function show() {
    const r = btn.current!.getBoundingClientRect();
    const room = window.innerHeight - r.bottom, up = room < 240 && r.top > room;
    setPos({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, width: Math.max(r.width, 150), up });
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }
  function pick(v: string) { onChange(v); setOpen(false); btn.current?.focus(); }

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { const t = e.target as Node; if (!btn.current?.contains(t) && !list.current?.contains(t)) setOpen(false); };
    const close = (e: Event) => { if (!list.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    window.addEventListener("resize", close); window.addEventListener("scroll", close, true);
    return () => { document.removeEventListener("mousedown", away); window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); };
  }, [open]);
  useEffect(() => { if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [open, active]);

  function key(e: React.KeyboardEvent) {
    if (!open) { if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); show(); } return; }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (options[active]) pick(options[active].value); }
    else if (e.key === "Tab") setOpen(false);
  }

  const small = size === "sm";
  return (
    <>
      <button ref={btn} type="button" disabled={disabled} onClick={() => (open ? setOpen(false) : show())} onKeyDown={key}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={ariaLabel}
        className={`flex w-full items-center justify-between gap-2 border border-slate-200 bg-white text-left outline-none transition hover:border-indigo-300 focus-visible:border-indigo-400 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/25 ${small ? "rounded-lg px-2 py-1 text-xs" : "rounded-xl px-3 py-2 text-sm"} ${open ? "border-indigo-400 dark:border-indigo-400/60" : ""} ${className}`}>
        <span className={`min-w-0 flex-1 truncate ${current ? "" : "text-slate-400"}`}>{current ? current.label : placeholder}</span>
        <ChevronDown size={small ? 13 : 16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div ref={list} id={id} role="listbox" aria-label={ariaLabel}
          style={{ left: pos.left, top: pos.top, minWidth: pos.width, transform: pos.up ? "translateY(-100%)" : undefined, maxWidth: "min(92vw, 420px)" }}
          className="fixed z-[95] max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 text-sm text-slate-700 shadow-2xl dark:border-white/10 dark:bg-[#1b1b30] dark:text-slate-100">
          {options.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">Nothing to choose</div>}
          {options.map((o, i) => (
            <div key={o.value} data-i={i} role="option" aria-selected={o.value === value} onMouseEnter={() => setActive(i)} onClick={() => pick(o.value)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 ${small ? "text-xs" : ""} ${i === active ? "bg-indigo-50 text-indigo-700 dark:bg-white/10 dark:text-white" : ""} ${o.value === value ? "font-semibold" : ""}`}>
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.value === value && <Check size={14} className="shrink-0 text-indigo-500" />}
            </div>
          ))}
        </div>, document.body)}
    </>
  );
}
