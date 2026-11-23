"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Film, Music, Shapes, Layers, Star, Download, Eye, CheckSquare, Square, Loader2, Info, Archive, Sparkles } from "lucide-react";
import Lightbox, { type Dims, type LightboxItem } from "@/components/Lightbox";
import { idToken } from "@/lib/firebase";
import { Package } from "lucide-react";
import type { PageResult } from "@/lib/report";
import { groupMedia, type MediaGroup } from "@/lib/mediaGroup";

type Item = MediaGroup;
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

const fmtSize = (b: number) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
const words = (s?: string) => (s || "").trim().split(/\s+/).filter(Boolean).length;

/** Short, readable name: alt text if short, else the file name without numbers, hashes and codes. */
function niceName(it: Item, i: number) {
  const alt = (it.alt || "").replace(/\s+/g, " ").trim();
  if (alt && alt.length <= 40) return alt;
  if (alt) return alt.split(" ").slice(0, 5).join(" ") + "…";
  if (it.url.startsWith("data:")) return `Inline ${it.type.toUpperCase()} ${i + 1}`;
  let stem = "";
  try { stem = decodeURIComponent(new URL(it.url).pathname.split("/").filter(Boolean).pop() || ""); } catch { /* ignore */ }
  const parts = stem.replace(/\.[a-z0-9]{2,5}$/i, "").split(/[-_.\s+]+/)
    // drop numbers, hashes, size codes (800x600, @2x, w640) and 1-2 letter bits
    .filter((w) => w.length > 2 && !/^\d+$/.test(w) && !/^[a-f0-9]{8,}$/i.test(w) && !/^\d+x\d+$|^@?\dx$|^[wh]\d+$/i.test(w));
  const name = parts.slice(0, 6).join(" ");
  return name ? name[0].toUpperCase() + name.slice(1) : `${it.type[0].toUpperCase()}${it.type.slice(1)} ${i + 1}`;
}

type AiInfo = { name?: string; description?: string; size?: number; type?: string; note?: string; error?: string };
const aiCache = new Map<string, AiInfo>();
const sizeCache = new Map<string, { size?: number; type?: string }>();
const canAi = (it: Item) => /^https?:\/\//i.test(it.url) && ["image", "background", "icon"].includes(it.type) && !/\.svg(\?|$)/i.test(it.url);

/** Clean, file-system-safe download name: cached AI name, else alt text, else tidied file name (+ the real extension). */
function niceFileName(it: Item, i: number, type?: string) {
  const ext = fileName(it, i, type).match(/\.[a-z0-9]{2,5}$/i)?.[0] || "";
  const base = (aiCache.get(it.url)?.name || niceName(it, i)).replace(/…$/, "").replace(/[\\/:*?"<>|#%{}^~[\]`'.,;!&$@=+]+/g, " ").trim().replace(/\s+/g, "-").slice(0, 60).replace(/-+$/, "");
  return (base || `${it.type}-${i + 1}`) + ext.toLowerCase();
}
const descOf = (it: Item) => (words(it.alt) >= 3 ? it.alt!.trim() : aiCache.get(it.url)?.description || "");
// Quotes every cell; a leading = + - @ gets a ' so spreadsheet apps never run website text as a formula
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;

/** Right-side info panel in the media viewer: name, description, size, type, where it was found. */
function MediaInfo({ it, i, dims, onAi }: { it: Item; i: number; dims: Dims; onAi: () => void }) {
  const altDesc = words(it.alt) >= 3 ? it.alt!.trim() : "";
  const [ai, setAi] = useState<AiInfo | null>(() => aiCache.get(it.url) || null);
  const [meta, setMeta] = useState(() => sizeCache.get(it.url) || null);
  const needAi = !altDesc && canAi(it);

  // File size + type (from the crawl, else ask our server once)
  useEffect(() => {
    if (it.size || !/^https?:\/\//i.test(it.url) || sizeCache.has(it.url)) return;
    let live = true;
    const t = setTimeout(() => {
      fetch(`/api/media?url=${encodeURIComponent(it.url)}&info=1`).then((r) => (r.ok ? r.json() : { size: 0 })).then((j: { size?: number; type?: string }) => {
        sizeCache.set(it.url, j);
        if (live) setMeta(j);
      }).catch(() => { if (live) setMeta({}); });
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [it]);

  // AI name + description, only when the image has no useful alt text (waits a moment so fast arrowing doesn't spend calls)
  useEffect(() => {
    if (!needAi || aiCache.has(it.url)) return;
    let live = true;
    const t = setTimeout(async () => {
      const token = await idToken();
      const j: AiInfo = await fetch("/api/describe", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url: it.url, alt: it.alt, page: it.pages[0] }),
      }).then((r) => r.json()).catch(() => ({ note: "AI description is not available right now." }));
      if (j.name || j.description || /too big|works for|couldn't describe/i.test(j.note || "")) aiCache.set(it.url, j);
      if (live) { setAi(j); if (j.name) onAi(); }
    }, 700);
    return () => { live = false; clearTimeout(t); };
  }, [it, needAi, onAi]);

  const name = ai?.name || niceName(it, i);
  const w = dims?.w || it.w, h = dims?.h || it.h;
  const size = it.size || ai?.size || meta?.size;
  const mime = it.mime || ai?.type || meta?.type || "";
  const ext = (mime.split("/")[1] || it.url.match(/\.([a-z0-9]{2,5})(\?|#|$)/i)?.[1] || it.type).replace(/^svg\+xml$/, "svg").replace(/^jpeg$/, "jpg").toUpperCase();
  const row = (k: string, v: React.ReactNode) => v ? <div className="flex justify-between gap-3 border-b border-white/10 py-2 text-xs last:border-0"><span className="text-white/50">{k}</span><span className="min-w-0 break-words text-right font-medium">{v}</span></div> : null;
  let pageLabel = it.pages[0] || "";
  try { const u = new URL(pageLabel); pageLabel = u.hostname.replace(/^www\./, "") + (u.pathname === "/" ? "" : u.pathname); } catch { /* keep */ }

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300">Name</div>
      <h3 className="mt-1 text-lg font-semibold leading-snug">{name}</h3>
      <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-indigo-300">Description</div>
      <p className="mt-1 text-sm leading-relaxed text-white/80">
        {altDesc ? altDesc
          : ai?.description ? <>{ai.description} <span className="ml-1 inline-flex items-center gap-1 rounded bg-indigo-500/20 px-1.5 py-0.5 align-middle text-[10px] text-indigo-200"><Sparkles size={10} /> AI</span></>
          : needAi && !ai ? <span className="inline-flex items-center gap-2 text-white/60"><Loader2 size={14} className="animate-spin" /> Writing a description…</span>
          : <span className="text-white/50">{ai?.note || ai?.error || (it.alt ? it.alt : "No description on the website.")}</span>}
      </p>
      <div className="mt-5 rounded-xl bg-black/20 px-3">
        {row("Dimensions", w && h ? `${w} × ${h} px` : "")}
        {row("File size", size ? fmtSize(size) : it.url.startsWith("data:") ? fmtSize(Math.round(it.url.length * 0.75)) : meta ? "Unknown" : "…")}
        {row("Type", it.type === "video" || it.type === "audio" ? `${it.type[0].toUpperCase()}${it.type.slice(1)} · ${ext}` : ext)}
        {row("File name", <span title={it.url}>{fileName(it, i)}</span>)}
        {row("Found on", pageLabel ? <a href={it.pages[0]} target="_blank" rel="noreferrer noopener" className="text-indigo-300 hover:underline">{pageLabel}</a> : "")}
        {it.pages.length > 1 && row("Used on", `${it.pages.length} pages`)}
      </div>
      {it.variants.length > 1 && (
        <div className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300">Other sizes of this image ({it.variants.length - 1})</div>
          <ul className="mt-2 grid gap-1.5">
            {it.variants.filter((v) => v.url !== it.url).slice(0, 12).map((v) => (
              <li key={v.url}><a href={v.url} target="_blank" rel="noreferrer noopener" title={v.url} className="flex justify-between gap-3 rounded-lg bg-black/20 px-3 py-2 text-xs hover:bg-white/10">
                <span className="truncate text-white/70">{/(desktop|mobile|tablet)/i.exec(v.url)?.[1] || decodeURIComponent(v.url.split("?")[1] || "").slice(0, 40) || fileName({ ...it, ...v }, i)}</span>
                <span className="shrink-0 font-medium">{v.w && v.h ? `${v.w} × ${v.h}` : "Open"}</span>
              </a></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function save(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const card = "glass-panel min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]";

export default function MediaView({ pages, host }: { pages: PageResult[]; host: string }) {
  // Same picture on many pages / in many sizes is shown once (see lib/mediaGroup.ts)
  const items = useMemo(() => groupMedia(pages), [pages]);

  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("all");
  const [hideTiny, setHideTiny] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<number | null>(null);
  const [, setAiTick] = useState(0); // re-render the viewer title when an AI name arrives
  const onAi = useCallback(() => setAiTick((n) => n + 1), []);

  const tiny = (it: Item) => !!(it.w && it.h && it.w < 48 && it.h < 48 && it.type !== "icon");
  const shown = items.filter((it) => (type === "all" || it.type === type) && !(hideTiny && tiny(it)));
  const count = (t: string) => items.filter((it) => (t === "all" || it.type === t) && !(hideTiny && tiny(it))).length;
  const toggle = (u: string) => setSel((s) => { const n = new Set(s); if (n.has(u)) n.delete(u); else n.add(u); return n; });
  const allSel = shown.length > 0 && shown.every((it) => sel.has(it.url));

  async function downloadOne(it: Item, i: number) {
    try {
      const b = await getBlob(it);
      save(niceFileName(it, i, b.type), b);
    } catch (e) {
      if (!/^https?:\/\//i.test(it.url)) setNote("Couldn't download this file.");
      else if ((e as Error).message === "too-large") window.open(it.url, "_blank", "noopener");
      else { setNote(`Couldn't download: ${(e as Error).message}. Opening the original instead.`); window.open(it.url, "_blank", "noopener"); }
    }
  }

  async function downloadZip(list: Item[], folderOf: (it: Item) => string = (it) => `${it.type}s`, zipName = `${host}-media.zip`) {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const failed: Item[] = [];
    const names = new Set<string>();
    const rows: unknown[][] = [];
    let done = 0, idx = 0;
    setBusy({ done: 0, total: list.length }); setNote(null);
    const worker = async () => {
      while (idx < list.length) {
        const i = idx++, it = list[i];
        try {
          const b = await getBlob(it);
          const first = `${folderOf(it)}/${niceFileName(it, i, b.type)}`;
          let name = first;
          for (let k = 2; names.has(name.toLowerCase()); k++) name = first.replace(/(\.\w+)?$/, `-${k}$1`);
          names.add(name.toLowerCase());
          rows.push([aiCache.get(it.url)?.name || niceName(it, i), name, fileName(it, i, b.type), it.w && it.h ? `${it.w}x${it.h}` : "", b.size, b.type, descOf(it), it.pages[0], it.url.startsWith("data:") ? "(inline)" : it.url, it.pages.length, it.variants.length - 1]);
          zip.file(name, b);
        } catch { failed.push(it); }
        setBusy({ done: ++done, total: list.length });
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    // Spreadsheet with each file's details (opens in Excel / Google Sheets)
    const head = ["Name", "File in ZIP", "Original file name", "Dimensions", "Size (bytes)", "Type", "Description", "Found on page", "Source URL", "Found on (pages)", "Other sizes"];
    zip.file("images-info.csv", "\uFEFF" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n"));
    if (failed.length) zip.file("NOT-INCLUDED.txt", "These files were too big (over 4 MB) or blocked by the website. Open them directly:\n\n" + failed.map((f) => f.url).join("\n"));
    save(zipName, await zip.generateAsync({ type: "blob" }));
    setBusy(null);
    setNote(`Downloaded ${list.length - failed.length} of ${list.length} files.${failed.length ? ` ${failed.length} were too big or blocked; their links are in NOT-INCLUDED.txt inside the ZIP.` : ""}`);
  }

  /** Brand asset kit: logo(s), favicons/app icons, SVG icons and images (no backgrounds/videos), sorted into folders. */
  function downloadKit() {
    const isLogo = (it: Item) => /logo|brand|wordmark/i.test(it.url + " " + (it.alt || ""));
    const kit = items.filter((it) => it.type !== "video" && it.type !== "audio" && it.type !== "background" && !tiny(it));
    downloadZip(kit, (it) => (it.type === "icon" ? "favicon" : isLogo(it) ? "logo" : it.type === "svg" ? "svg-icons" : it.type === "gif" ? "gifs" : "images"), `${host}-asset-kit.zip`);
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
          <button disabled={!!busy} onClick={downloadKit} title="Logo, favicons, SVG icons and all images in one ZIP"
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 dark:border-indigo-400/40 dark:text-indigo-200 dark:hover:bg-white/5">
            <Package size={16} /> Asset kit (.zip)
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
                  <span>{[it.variants.length > 1 ? `${it.variants.length} sizes` : "", it.pages.length > 1 ? `${it.pages.length} pages` : ""].filter(Boolean).join(" · ")}</span>
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
            title: aiCache.get(it.url)?.name || niceName(it, i),
            original: it.url.startsWith("data:") ? undefined : it.url,
          }))}
          index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} onDownload={(i) => downloadOne(shown[i], i)}
          fit side={(dims) => <MediaInfo key={shown[viewing].url} it={shown[viewing]} i={viewing} dims={dims} onAi={onAi} />} />
      )}
    </div>
  );
}
