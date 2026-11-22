"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCircle2, AlertTriangle, XCircle, Info, X, BellRing, CheckCheck, Trash2 } from "lucide-react";
import { ago, type Note } from "@/lib/notify";

const ICON = { success: [CheckCircle2, "text-emerald-500"], error: [XCircle, "text-rose-500"], warning: [AlertTriangle, "text-amber-500"], info: [Info, "text-indigo-500"] } as const;

type Props = { notes: Note[]; unread: number; markAllRead: () => void; remove: (id: string) => void; clear: () => void; onOpenNote: (n: Note) => void };

/** Metal bell button (matches the theme toggle) with an unread badge and a dropdown list. */
export default function NotificationBell({ notes, unread, markAllRead, remove, clear, onOpenNote }: Props) {
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(() => (typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"));
  const [, tick] = useState(0); // refresh the "x min ago" labels while open
  const ref = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !panel.current?.contains(t)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const id = setInterval(() => tick((x) => x + 1), 30000);
    document.addEventListener("mousedown", off); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); clearInterval(id); };
  }, [open]);

  function toggle() {
    if (open) markAllRead(); // opened and seen: clear the badge when closing
    else { const r = ref.current!.getBoundingClientRect(); setPos({ top: r.bottom + 10, right: Math.max(8, window.innerWidth - r.right) }); }
    setOpen(!open);
  }

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button type="button" onClick={toggle} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} aria-expanded={open} title="Notifications" className="tt tt-round">
        <span className="tt-sheen" aria-hidden /><Bell size={18} strokeWidth={2.2} className="tt-icon" />
      </button>
      {unread > 0 && (
        <span className="pointer-events-none absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow ring-2 ring-white dark:ring-[#0d0d17]">{unread > 9 ? "9+" : unread}</span>
      )}

      {open && createPortal(
        <div ref={panel} style={pos} className="fixed z-[90] w-[340px] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#16162a]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/10">
            <div className="flex-1 font-semibold">Notifications</div>
            {notes.length > 0 && <>
              <button onClick={markAllRead} title="Mark all as read" aria-label="Mark all as read" className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><CheckCheck size={16} /></button>
              <button onClick={clear} title="Clear all" aria-label="Clear all" className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><Trash2 size={15} /></button>
            </>}
          </div>

          {perm === "default" && (
            <button onClick={() => Notification.requestPermission().then(setPerm)} className="flex w-full items-center gap-2 border-b border-slate-100 bg-indigo-50 px-4 py-2.5 text-left text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-white/10 dark:bg-indigo-500/10 dark:text-indigo-200">
              <BellRing size={15} /> Get a desktop alert when a scan finishes in the background
            </button>
          )}

          <div className="max-h-[360px] overflow-y-auto no-scrollbar">
            {notes.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                <Bell size={22} className="mx-auto mb-2 opacity-40" />
                No notifications yet. You&apos;ll see finished scans, saves and alerts here.
              </div>
            ) : notes.map((n) => {
              const [Icon, color] = ICON[n.kind];
              return (
                <div key={n.id} className={`group flex gap-3 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-white/5 ${n.read ? "" : "bg-indigo-50/60 dark:bg-indigo-500/[0.07]"}`}>
                  <Icon size={18} className={`mt-0.5 shrink-0 ${color}`} />
                  <button onClick={() => { onOpenNote(n); setOpen(false); markAllRead(); }} className="min-w-0 flex-1 text-left" disabled={!n.view}>
                    <div className="text-sm font-medium">{n.title}</div>
                    {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{n.body}</div>}
                    <div className="mt-1 text-[11px] text-slate-400">{ago(n.at)}</div>
                  </button>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" aria-label="Unread" />}
                  <button onClick={() => remove(n.id)} aria-label="Dismiss" className="shrink-0 self-start text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-slate-600 focus:opacity-100"><X size={14} /></button>
                </div>
              );
            })}
          </div>
        </div>, document.body
      )}
    </div>
  );
}
