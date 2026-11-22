"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect } from "react";
import { X, Download, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

export type LightboxItem = { src: string; kind: "image" | "video" | "audio"; title: string; subtitle?: string; original?: string };

/** Full-screen viewer for screenshots and media, with download and arrow-key navigation. */
export default function Lightbox({ items, index, onIndex, onClose, onDownload }: {
  items: LightboxItem[]; index: number; onIndex: (i: number) => void; onClose: () => void; onDownload: (i: number) => void;
}) {
  const it = items[index];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % items.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, items.length, onClose, onIndex]);
  if (!it) return null;
  const btn = "grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20";
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center gap-3 p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{it.title}</div>
          {it.subtitle && <div className="truncate text-xs text-white/60">{it.subtitle}</div>}
        </div>
        <span className="text-xs text-white/60">{index + 1} / {items.length}</span>
        <button onClick={() => onDownload(index)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white/90"><Download size={16} /> Download</button>
        {it.original && <a href={it.original} target="_blank" rel="noreferrer noopener" className={btn} title="Open original"><ExternalLink size={18} /></a>}
        <button onClick={onClose} className={btn} aria-label="Close"><X size={20} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-16 pb-6" onClick={(e) => e.stopPropagation()}>
        {items.length > 1 && <button onClick={() => onIndex((index - 1 + items.length) % items.length)} className={`${btn} absolute left-4`} aria-label="Previous"><ChevronLeft size={22} /></button>}
        <div className="max-h-full max-w-full overflow-auto rounded-xl">
          {it.kind === "video" ? <video src={it.src} controls autoPlay muted className="max-h-[80vh] max-w-full rounded-xl" />
            : it.kind === "audio" ? <audio src={it.src} controls autoPlay className="w-[min(90vw,480px)]" />
            : <img src={it.src} alt={it.title} referrerPolicy="no-referrer" className="max-w-full rounded-xl" style={{ maxHeight: "none" }} />}
        </div>
        {items.length > 1 && <button onClick={() => onIndex((index + 1) % items.length)} className={`${btn} absolute right-4`} aria-label="Next"><ChevronRight size={22} /></button>}
      </div>
    </div>
  );
}
