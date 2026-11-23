"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, Download, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

export type LightboxItem = { src: string; kind: "image" | "video" | "audio"; title: string; subtitle?: string; original?: string };

export type Dims = { w: number; h: number } | null;

/**
 * Full-screen viewer for screenshots and media, with download and arrow-key navigation.
 * `fit`: the whole image/video always fits the screen (no scrolling). `side`: an info panel
 * on the right (below on phones); it gets the media's real pixel size once loaded.
 */
export default function Lightbox({ items, index, onIndex, onClose, onDownload, fit, side }: {
  items: LightboxItem[]; index: number; onIndex: (i: number) => void; onClose: () => void; onDownload: (i: number) => void;
  fit?: boolean; side?: (dims: Dims) => ReactNode;
}) {
  const it = items[index];
  const [dims, setDims] = useState<{ src: string; d: Dims }>({ src: "", d: null });
  const shownDims = dims.src === it?.src ? dims.d : null;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % items.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, items.length, onClose, onIndex]);
  if (!it || typeof document === "undefined") return null;
  const btn = "grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20";
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm" onClick={onClose}>
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
      {fit ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 lg:flex-row lg:overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="relative h-[60vh] shrink-0 lg:h-auto lg:min-w-0 lg:flex-1">
            {it.kind === "video" ? <video key={it.src} src={it.src} controls autoPlay muted onLoadedMetadata={(e) => setDims({ src: it.src, d: { w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight } })} className="absolute inset-0 h-full w-full object-contain" />
              : it.kind === "audio" ? <div className="absolute inset-0 grid place-items-center"><audio src={it.src} controls autoPlay className="w-[min(90vw,480px)]" /></div>
              : <img key={it.src} src={it.src} alt={it.title} referrerPolicy="no-referrer" onLoad={(e) => setDims({ src: it.src, d: { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight } })} className="absolute inset-0 h-full w-full object-contain" />}
            {items.length > 1 && <button onClick={() => onIndex((index - 1 + items.length) % items.length)} className={`${btn} absolute left-2 top-1/2 -translate-y-1/2`} aria-label="Previous"><ChevronLeft size={22} /></button>}
            {items.length > 1 && <button onClick={() => onIndex((index + 1) % items.length)} className={`${btn} absolute right-2 top-1/2 -translate-y-1/2`} aria-label="Next"><ChevronRight size={22} /></button>}
          </div>
          {side && <aside className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-white backdrop-blur-md lg:w-80 lg:overflow-y-auto">{side(shownDims)}</aside>}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-16 pb-6" onClick={(e) => e.stopPropagation()}>
          {items.length > 1 && <button onClick={() => onIndex((index - 1 + items.length) % items.length)} className={`${btn} absolute left-4`} aria-label="Previous"><ChevronLeft size={22} /></button>}
          <div className="max-h-full max-w-full overflow-auto rounded-xl">
            {it.kind === "video" ? <video src={it.src} controls autoPlay muted className="max-h-[80vh] max-w-full rounded-xl" />
              : it.kind === "audio" ? <audio src={it.src} controls autoPlay className="w-[min(90vw,480px)]" />
              : <img src={it.src} alt={it.title} referrerPolicy="no-referrer" className="max-w-full rounded-xl" style={{ maxHeight: "none" }} />}
          </div>
          {items.length > 1 && <button onClick={() => onIndex((index + 1) % items.length)} className={`${btn} absolute right-4`} aria-label="Next"><ChevronRight size={22} /></button>}
        </div>
      )}
    </div>,
    document.body
  );
}
