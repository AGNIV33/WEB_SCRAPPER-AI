"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { Image as ImageIcon, Film, Music, Shapes, Layers, Star, Download, Eye, CheckSquare, Square, Loader2, Info, Archive, Sparkles } from "lucide-react";
import Lightbox, { type LightboxItem } from "@/components/Lightbox";
import type { MediaItem, PageResult } from "@/lib/report";

type Item = MediaItem & { pages: string[] };
const TYPES = [
  { id: "all", label: "All", icon: Layers },
  { id: "image", label: "Images", icon: ImageIcon },
  { id: "gif", label: "GIFs", icon: Sparkles },
  { id: "svg", label: "SVG", icon: Shapes },
  { id: "background", label: "Backgrounds", icon: Layers },
  { id: "video", label: "Videos", icon: Film },
  { id: "audio", label: "Audio", icon: Music },
  { id: "icon", label: "Icons", icon: Star },
] as const;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif", "image/svg+xml": "svg", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico", "video/mp4": "mp4", "video/webm": "webm", "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav" };

function fileName(it: Item, i: number, type?: string) {
  if (it.url.startsWith("data:")) {
    const mime = it.url.slice(5).split(/[;,]/)[0];
    return `${it.type}-${i + 1}.${EXT[mime] || "bin"}`;
  }
  let base = "";
  try { base = decodeURIComponent(new URL(it.url).pathname.split("/").filter(Boolean).pop() || ""); } catch { /* ignore */ }
  base = base.replace(/[^\w.\-]+/g, "_").slice(0, 80) || `${it.type}-${i + 1}`;
  if (!/\.[a-z0-9]{2,5}$/i.test(base)) base += "." + (EXT[type || ""] || "bin");
  return base;
}

/** Gets the file's bytes: data URLs directly, everything else through our safe server proxy. */
async function getBlob(it: Item): Promise<Blob> {
  if (it.url.startsWith("data:")) return (await fetch(it.url)).blob();
  const r = await fetch(`/api/media?url=${encodeURIComponent(it.url)}`);
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error === "too-large" ? "too-large" : j.error || `Error ${r.status}`);
  }
  return r.blob();
}

function save(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const card = "glass-panel rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]";

export default function MediaView({ pages, host }: { pages: PageResult[]; host: string }) {
  const items = useMemo(() => {
    const m = new Map<string, Item>();
    for (const p of pages) for (const it of p.media || []) {
      const e = m.get(it.url);
      if (e) { if (!e.pages.includes(p.url)) e.pages.push(p.url); } else m.set(it.url, { ...it, pages: [p.url] });
    }
    return [...m.values()];
  }, [pages]);

  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("all");
  const [hideTiny, setHideTiny] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<number | null>(null);

  const tiny = (it: Item) => !!(it.w && it.h && it.w < 48 && it.h < 48 && it.type !== "icon");
  const shown = items.filter((it) => (type === "all" || it.type === type) && !(hideTiny && tiny(it)));
  const count = (t: string) => items.filter((it) => (t === "all" || it.type === t) && !(hideTiny && tiny(it))).length;
  const toggle = (u: string) => setSel((s) => { const n = new Set(s); if (n.has(u)) n.delete(u); else n.add(u); return n; });
  const allSel = shown.length > 0 && shown.every((it) => sel.has(it.url));

  async function downloadOne(it: Item, i: number) {
    try {
      const b = await getBlob(it);
      save(fileName(it, i, b.type), b);
    } catch (e) {
      if ((e as Error).message === "too-large") window.open(it.url, "_blank", "noopener");
      else { setNote(`Couldn't download: ${(e as Error).message}. Opening the original instead.`); window.open(it.url, "_blank", "noopener"); }
    }
  }

  async function downloadZip(list: Item[]) {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const failed: Item[] = [];
    const names = new Set<string>();
    let done = 0, idx = 0;
    setBusy({ done: 0, total: list.length }); setNote(null);
    const worker = async () => {
      while (idx < list.length) {
        const i = idx++, it = list[i];
        try {
          const b = await getBlob(it);
          let name = `${it.type}s/${fileName(it, i, b.type)}`;
          for (let k = 2; names.has(name); k++) name = name.replace(/(\.\w+)?$/, `-${k}$1`);
          names.add(name);
          zip.file(name, b);
        } catch { failed.push(it); }
        setBusy({ done: ++done, total: list.length });
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    if (failed.length) zip.file("NOT-INCLUDED.txt", "These files were too big (over 4 MB) or blocked by the website. Open them directly:\n\n" + failed.map((f) => f.url).join("\n"));
    save(`${host}-media.zip`, await zip.generateAsync({ type: "blob" }));
    setBusy(null);
    setNote(`Downloaded ${list.length - failed.length} of ${list.length} files.${failed.length ? ` ${failed.length} were too big or blocked; their links are in NOT-INCLUDED.txt inside the ZIP.` : ""}`);
  }

  if (!items.length) {
    return <div className={`${card} p-8 text-center text-sm text-slate-500 dark:text-slate-400`}><ImageIcon className="mx-auto mb-2 text-slate-400" />No media found. Run a new analysis to collect images and media (older saved analyses don&apos;t have this data).</div>;
  }

  return (
    <div className="grid gap-5">
      <div data-anim="card" className={`${card} p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          {TYPES.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setType(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${type === id ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"}`}>
              <Icon size={14} /> {label} <span className="opacity-70">{count(id)}</span>
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <input type="checkbox" checked={hideTiny} onChange={(e) => setHideTiny(e.target.checked)} className="accent-indigo-500" /> Hide tiny images
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={() => setSel((s) => { const n = new Set(s); shown.forEach((it) => (allSel ? n.delete(it.url) : n.add(it.url))); return n; })}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
            {allSel ? <CheckSquare size={16} /> : <Square size={16} />} {allSel ? "Unselect all" : `Select all (${shown.length})`}
          </button>
          <button disabled={!sel.size || !!busy} onClick={() => downloadZip(items.filter((it) => sel.has(it.url)))}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-40">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
            {busy ? `Downloading ${busy.done}/${busy.total}…` : `Download selected (${sel.size}) as ZIP`}
          </button>
          <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Info size={14} /> Media belongs to the website owner. Use it for reference and respect copyright.</span>
        </div>
        {note && <p className="mt-3 rounded-lg bg-indigo-50 p-2.5 text-xs text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">{note}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {shown.map((it, i) => {
          const on = sel.has(it.url);
          return (
            <div key={it.url} className={`${card} group overflow-hidden ${on ? "ring-2 ring-indigo-500" : ""}`}>
              <button onClick={() => toggle(it.url)} className="relative block aspect-[4/3] w-full bg-[repeating-conic-gradient(#e2e8f0_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] dark:bg-[repeating-conic-gradient(#1e1e2e_0%_25%,#26263a_0%_50%)]">
                {it.type === "video" ? (
                  it.poster ? <img src={it.poster} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    : <video src={`${it.url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : it.type === "audio" ? (
                  <Music className="absolute inset-0 m-auto text-slate-400" size={32} />
                ) : broken.has(it.url) ? (
                  <ImageIcon className="absolute inset-0 m-auto text-slate-400" size={28} />
                ) : (
                  <img src={it.url} alt={it.alt || ""} loading="lazy" decoding="async" referrerPolicy="no-referrer"
                    onError={() => setBroken((b) => new Set(b).add(it.url))} className="h-full w-full object-contain p-2" />
                )}
                <span className={`absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-md border text-white ${on ? "border-indigo-500 bg-indigo-500" : "border-white/80 bg-black/30 opacity-0 group-hover:opacity-100"}`}>{on && "✓"}</span>
                {(it.type === "video" || it.type === "audio") && <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">{it.type}</span>}
              </button>
              <div className="p-3">
                <div className="truncate text-xs font-medium" title={it.url.startsWith("data:") ? "inline SVG" : it.url}>{it.url.startsWith("data:") ? `Inline ${it.type.toUpperCase()}` : fileName(it, i)}</div>
                <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{it.type}{it.w && it.h ? ` · ${it.w}×${it.h}` : ""}{it.size ? ` · ${it.size > 1048576 ? (it.size / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(it.size / 1024)) + " KB"}` : ""}</span>
                  <span>{it.pages.length > 1 ? `${it.pages.length} pages` : ""}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setViewing(i)} title="View" className="grid w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"><Eye size={13} /></button>
                  <button onClick={() => downloadOne(it, i)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-50 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-200"><Download size={13} /> Download</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {viewing !== null && (
        <Lightbox
          items={shown.map((it, i): LightboxItem => ({
            src: it.url, kind: it.type === "video" ? "video" : it.type === "audio" ? "audio" : "image",
            title: it.url.startsWith("data:") ? `Inline ${it.type.toUpperCase()}` : fileName(it, i),
            subtitle: [it.type, it.w && it.h ? `${it.w}×${it.h}` : "", it.pages[0]].filter(Boolean).join(" · "),
            original: it.url.startsWith("data:") ? undefined : it.url,
          }))}
          index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} onDownload={(i) => downloadOne(shown[i], i)} />
      )}
    </div>
  );
}
