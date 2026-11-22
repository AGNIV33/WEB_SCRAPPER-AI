"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Download, Eye, Archive, Smartphone, Monitor, Tablet } from "lucide-react";
import type { PageResult } from "@/lib/report";
import Lightbox, { type LightboxItem } from "@/components/Lightbox";

const pathOf = (u: string) => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };
const hostOf = (u?: string) => { try { return new URL(u!).hostname; } catch { return "site"; } };
const card = "glass-panel min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]";

type Device = "desktop" | "tablet" | "mobile";
type Shot = { src: string; page: PageResult; device: Device };
const fileName = (s: Shot) => `${hostOf(s.page.url)}${pathOf(s.page.url).replace(/\W+/g, "-").replace(/-$/, "") || "-home"}${s.device === "desktop" ? "" : "-" + s.device}.jpg`;

function save(name: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl; a.download = name; a.click();
}

/** Every page's screenshot (desktop + mobile) with View (full screen) and Download buttons, plus a ZIP of all. */
export default function ScreenshotGallery({ pages }: { pages: PageResult[] }) {
  const shots: Shot[] = pages.filter((p) => !p.error).flatMap((p) => [
    ...(p.screenshot ? [{ src: p.screenshot, page: p, device: "desktop" as Device }] : []),
    ...(p.tabletScreenshot ? [{ src: p.tabletScreenshot, page: p, device: "tablet" as Device }] : []),
    ...(p.mobileScreenshot ? [{ src: p.mobileScreenshot, page: p, device: "mobile" as Device }] : []),
  ]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [filter, setFilter] = useState<"all" | Device>("all");
  const visible = shots.filter((s) => filter === "all" || s.device === filter);

  async function zipAll() {
    setZipping(true);
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    shots.forEach((s) => zip.file(fileName(s), s.src.split(",")[1], { base64: true }));
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${hostOf(pages[0]?.url)}-screenshots.zip`; a.click();
    setZipping(false);
  }

  if (!shots.length) return null;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{shots.length} screenshots · desktop (full page, 1280px), tablet (768px) and mobile (390px)</p>
        <div className="flex gap-1.5">
          {(["all", "desktop", "tablet", "mobile"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${filter === f ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}>{f} {f === "all" ? shots.length : shots.filter((s) => s.device === f).length}</button>
          ))}
        </div>
        <button onClick={zipAll} disabled={zipping} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50">
          <Archive size={16} /> {zipping ? "Zipping…" : "Download all (.zip)"}
        </button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((s, i) => (
          <div key={s.page.url + s.device} data-anim="card" className={`${card} group overflow-hidden`}>
            <button onClick={() => setViewing(i)} className="relative block w-full" title="View full screenshot">
              <img loading="lazy" decoding="async" src={s.src} alt="" className={`w-full object-cover object-top transition duration-300 group-hover:scale-[1.02] ${s.device !== "desktop" ? "aspect-[4/3] object-contain bg-slate-100 dark:bg-white/5" : "aspect-[4/3]"}`} />
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
                {s.device === "mobile" ? <Smartphone size={12} /> : s.device === "tablet" ? <Tablet size={12} /> : <Monitor size={12} />} <span className="capitalize">{s.device}</span>
              </span>
            </button>
            <div className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.page.seo?.title || pathOf(s.page.url)}</div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">{pathOf(s.page.url)}</div>
              </div>
              <button onClick={() => setViewing(i)} title="View" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"><Eye size={15} /></button>
              <button onClick={() => save(fileName(s), s.src)} title="Download" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-200"><Download size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      {viewing !== null && (
        <Lightbox
          items={visible.map((s): LightboxItem => ({ src: s.src, kind: "image", title: s.page.seo?.title || pathOf(s.page.url), subtitle: `${s.device} · ${s.page.url}` }))}
          index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} onDownload={(i) => save(fileName(visible[i]), visible[i].src)} />
      )}
    </>
  );
}
