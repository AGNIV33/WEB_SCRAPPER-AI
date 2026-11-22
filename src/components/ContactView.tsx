"use client";

import { useEffect, useState } from "react";
import { Bug, Check, CheckCircle2, Clock, Lightbulb, LogIn, MessageSquare, Send } from "lucide-react";
import type { User } from "@/lib/firebase";
import { markRepliesSeen, myFeedback, sendFeedback, TYPE_LABEL, type FeedbackItem, type FeedbackType } from "@/lib/feedback";
import type { NoteKind } from "@/lib/notify";

const card = "glass-panel min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]";
const muted = "text-slate-500 dark:text-slate-400";
const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 dark:border-white/10 dark:bg-white/5";

const TYPES: { id: FeedbackType; label: string; hint: string; icon: React.ElementType }[] = [
  { id: "feedback", label: "Feedback", hint: "Tell us what you think", icon: MessageSquare },
  { id: "issue", label: "Report an issue", hint: "Something is broken or wrong", icon: Bug },
  { id: "idea", label: "Suggest an idea", hint: "A feature you would like", icon: Lightbulb },
];

export const STATUS_STYLE: Record<string, string> = {
  new: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  read: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  resolved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};
export const STATUS_LABEL: Record<string, string> = { new: "Sent", read: "Seen by admin", resolved: "Resolved" };

type Props = { user: User | null; onLogin: () => void; context: string; notify: (n: { kind: NoteKind; title: string; body?: string; view?: string }) => void };

/** Contact us: send feedback or report an issue. The admin reads these in the Admin dashboard and can reply here. */
export default function ContactView({ user, onLogin, context, notify }: Props) {
  const [type, setType] = useState<FeedbackType>("feedback");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [lastSent, setLastSent] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    let on = true;
    myFeedback().then((list) => { if (on) { setItems(list); markRepliesSeen(uid, list); } }).catch(() => { if (on) setItems([]); });
    return () => { on = false; };
  }, [uid, reloadKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Date.now() - lastSent < 20000) { setMsg({ ok: false, text: "Please wait a few seconds before sending another message." }); return; }
    setBusy(true); setMsg(null);
    try {
      await sendFeedback({ type, subject, message, view: context });
      setLastSent(Date.now());
      setSubject(""); setMessage("");
      setMsg({ ok: true, text: "Thank you! Your message was sent. You can follow its status below." });
      notify({ kind: "success", title: type === "issue" ? "Issue reported" : "Message sent", body: "The admin will see it in their dashboard.", view: "contact" });
      setReloadKey((k) => k + 1);
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message || "Could not send. Please try again." });
    } finally { setBusy(false); }
  }

  if (!user) {
    return (
      <div className={`${card} mx-auto max-w-lg p-8 text-center`}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><MessageSquare size={26} /></div>
        <h2 className="mt-4 text-xl font-bold">Contact us</h2>
        <p className={`mt-2 text-sm ${muted}`}>Log in to send feedback or report an issue. We read every message and reply here.</p>
        <button onClick={onLogin} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"><LogIn size={16} /> Log in</button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold"><MessageSquare size={22} className="text-indigo-500" /> Contact us</h2>
        <p className={`text-sm ${muted}`}>Send feedback, report a problem or suggest an idea. It goes straight to the admin dashboard.</p>
      </div>

      <form onSubmit={submit} className={`${card} grid gap-4 p-5`}>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map(({ id, label, hint, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setType(id)} aria-pressed={type === id}
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${type === id ? "border-indigo-400 bg-indigo-50 dark:border-indigo-400/60 dark:bg-indigo-500/10" : "border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"}`}>
              <Icon size={18} className={`mt-0.5 shrink-0 ${type === id ? "text-indigo-600 dark:text-indigo-300" : muted}`} />
              <span><span className="block text-sm font-semibold">{label}</span><span className={`block text-xs ${muted}`}>{hint}</span></span>
            </button>
          ))}
        </div>
        <label className="grid gap-1.5 text-sm font-medium">Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={120} placeholder={type === "issue" ? "What went wrong?" : "A short title"} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">Message
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={4000} rows={6}
            placeholder={type === "issue" ? "What did you do, what did you expect, and what happened instead? Include the website you scanned if it helps." : "Write your message here…"} className={`${field} resize-y`} />
          <span className={`text-right text-xs font-normal ${muted}`}>{message.length}/4000</span>
        </label>
        {msg && <p className={`flex items-start gap-2 rounded-xl p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"}`}>{msg.ok && <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}{msg.text}</p>}
        <div className="flex items-center gap-3">
          <button disabled={busy || !subject.trim() || !message.trim()} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50">
            <Send size={15} /> {busy ? "Sending…" : "Send"}
          </button>
          <span className={`text-xs ${muted}`}>Sent as {user.email}</span>
        </div>
      </form>

      <section>
        <h3 className="mb-3 font-semibold">Your messages</h3>
        {items === null ? <p className={`text-sm ${muted}`}>Loading…</p>
          : items.length === 0 ? <div className={`${card} p-6 text-center text-sm ${muted}`}>You have not sent any messages yet.</div>
          : <div className="grid gap-3">
              {items.map((f) => (
                <article key={f.id} className={`${card} p-4`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold dark:bg-white/10">{TYPE_LABEL[f.type]}</span>
                    <h4 className="min-w-0 flex-1 truncate font-semibold">{f.subject}</h4>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[f.status]}`}>{f.status === "resolved" ? <Check size={11} /> : <Clock size={11} />}{STATUS_LABEL[f.status]}</span>
                  </div>
                  <p className={`mt-2 whitespace-pre-wrap break-words text-sm ${muted}`}>{f.message}</p>
                  <div className={`mt-2 text-xs ${muted}`}>{f.createdAt?.toLocaleString() || "just now"}</div>
                  {f.reply && (
                    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 dark:border-indigo-400/30 dark:bg-indigo-500/10">
                      <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Reply from the admin{f.repliedAt ? ` · ${f.repliedAt.toLocaleString()}` : ""}</div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{f.reply}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>}
      </section>
    </div>
  );
}
