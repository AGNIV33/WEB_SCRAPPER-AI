"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircleQuestion, Send, Loader2, Sparkles, Trash2 } from "lucide-react";
import type { PageResult, Summary } from "@/lib/report";
import type { Extras } from "@/lib/insights";
import { reportFacts } from "@/lib/reportFacts";
import { askApi } from "@/lib/aiClient";
import MiniMarkdown from "@/components/MiniMarkdown";
import type { AiResult } from "@/components/Dashboard";

const card = "glass-panel min-w-0 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]";
const muted = "text-slate-500 dark:text-slate-400";
const STARTERS = [
  "What are the 3 biggest problems on this site?",
  "How can I make this site faster?",
  "Is this site safe to use?",
  "What should I fix first for SEO?",
  "Explain the accessibility issues simply",
  "Which colours and fonts does it use?",
];

type Turn = { role: "user" | "assistant"; content: string; error?: boolean };

/** "Ask AI": chat about the current report. Answers come only from the measured facts. */
export default function ChatView({ summary, pages, ai, extras, busy }: { summary: Summary; pages: PageResult[]; ai: AiResult | null; extras?: Extras | null; busy: boolean }) {
  const facts = useMemo(() => reportFacts({ summary, pages, ai, extras }), [summary, pages, ai, extras]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [waiting, setWaiting] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [turns, waiting]);

  const ask = async (q: string) => {
    q = q.trim();
    if (!q || waiting) return;
    const next = [...turns.filter((t) => !t.error), { role: "user" as const, content: q }];
    setTurns(next); setText(""); setWaiting(true);
    try {
      const r = await askApi<{ answer: string }>("/api/chat", { mode: "chat", facts, messages: next.map(({ role, content }) => ({ role, content })) });
      setTurns((t) => [...t, { role: "assistant", content: r.answer }]);
    } catch (e) {
      setTurns((t) => [...t, { role: "assistant", content: (e as Error).message, error: true }]);
    } finally { setWaiting(false); }
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold"><MessageCircleQuestion size={22} className="text-indigo-500" /> Ask AI about {facts.site}</h2>
          <p className={`text-sm ${muted}`}>Ask anything about this report in plain words. The AI only uses what was measured, so it won&apos;t make things up.</p>
        </div>
        {turns.length > 0 && <button onClick={() => setTurns([])} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/5 ${muted}`}><Trash2 size={14} /> Clear chat</button>}
      </div>
      {busy && <p className={`${card} flex items-center gap-2 text-sm ${muted}`}><Loader2 size={16} className="animate-spin" /> The scan is still running. You can ask now, but answers get better when it finishes.</p>}
      <section data-anim="card" className={`${card} grid gap-4`}>
        {!turns.length && (
          <div>
            <div className={`mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase ${muted}`}><Sparkles size={13} /> Try asking</div>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((q) => <button key={q} onClick={() => ask(q)} className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-white/10 dark:bg-white/5 dark:text-indigo-300 dark:hover:bg-white/10">{q}</button>)}
            </div>
          </div>
        )}
        {turns.length > 0 && (
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1" aria-live="polite">
            {turns.map((t, i) => t.role === "user"
              ? <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-indigo-500 px-4 py-2 text-sm text-white">{t.content}</div>
              : <div key={i} className={`mr-auto max-w-[90%] rounded-2xl rounded-bl-md px-4 py-2 ${t.error ? "bg-amber-50 text-sm text-amber-800 dark:bg-amber-500/15 dark:text-amber-200" : "bg-slate-100 text-slate-800 dark:bg-white/5 dark:text-slate-100"}`}>{t.error ? t.content : <MiniMarkdown text={t.content} />}</div>)}
            {waiting && <div className={`flex items-center gap-2 text-sm ${muted}`}><Loader2 size={16} className="animate-spin" /> Thinking…</div>}
            <div ref={end} />
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="flex gap-2">
          <label htmlFor="chat-q" className="sr-only">Your question</label>
          <input id="chat-q" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="e.g. Why is my SEO score low?"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-white/5 dark:focus:ring-indigo-500/30" />
          <button type="submit" disabled={!text.trim() || waiting} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"><Send size={15} /> Ask</button>
        </form>
        <p className={`text-xs ${muted}`}>AI can still be wrong. Check important answers in the report pages.</p>
      </section>
    </div>
  );
}
