"use client";
/* Extra report sections: tech stack (grouped), Google speed score + carbon, trust check, SEO fixes, competitors. */

import { useState } from "react";
import { Layers, Gauge, Leaf, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Wrench, Copy, Check, Users, ExternalLink, Loader2, Smartphone, Monitor, Sparkles } from "lucide-react";
import type { CompetitorResult, Extras, PsiRun, SeoFixResult, SpeedResult, StackItem, TrustResult } from "@/lib/insights";
import { categoryOf } from "@/lib/stack";

const card = "glass-panel min-w-0 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a] dark:shadow-none";
const muted = "text-slate-500 dark:text-slate-400";
const tone = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
};
type Tone = keyof typeof tone;
const Badge = ({ children, t = "slate" }: { children: React.ReactNode; t?: Tone }) => <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tone[t]}`}>{children}</span>;
const scoreTone = (n: number | null): Tone => (n == null ? "slate" : n >= 90 ? "green" : n >= 50 ? "amber" : "red");
const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition";

function Card({ title, icon: Icon, right, children, className = "" }: { title: string; icon: React.ElementType; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section data-anim="card" className={`${card} ${className}`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Icon size={18} className="shrink-0 text-indigo-500" />
        <h3 className="font-semibold">{title}</h3>
        {right && <div className={`ml-auto flex items-center gap-2 text-xs ${muted}`}>{right}</div>}
      </div>
      {children}
    </section>
  );
}

/** Shown while a section is loading, or when it has no data. */
function Status({ busy, data, what }: { busy: boolean; data?: { error?: string; note?: string }; what: string }) {
  if (!data) return <div className={`${card} flex items-center gap-3 text-sm ${muted}`}>{busy ? <><Loader2 size={18} className="animate-spin text-indigo-500" /> Working on the {what}…</> : <>No {what} for this scan. Run a new analysis to get it.</>}</div>;
  if (data.error) return <div className={`${card} flex items-start gap-3 text-sm`}><AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" /><span>{data.error}</span></div>;
  return <div className={`${card} flex items-start gap-3 text-sm ${muted}`}><HelpCircle size={18} className="mt-0.5 shrink-0 text-indigo-500" /><span>{data.note}</span></div>;
}

export function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); })}
      className={`${btn} bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-white/10 dark:text-indigo-300 dark:hover:bg-white/15`}>
      {ok ? <Check size={13} /> : <Copy size={13} />}{ok ? "Copied" : "Copy"}
    </button>
  );
}

function Ring({ value, size = 84 }: { value: number | null; size?: number }) {
  const v = value ?? 0, r = (size - 10) / 2, c = 2 * Math.PI * r;
  const col = value == null ? "text-slate-300" : v >= 90 ? "text-emerald-500" : v >= 50 ? "text-amber-500" : "text-red-500";
  return (
    <div className={`relative ${col}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={8} /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={8} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} /></svg>
      <div className="absolute inset-0 grid place-items-center text-xl font-bold text-slate-900 dark:text-white">{value ?? "—"}</div>
    </div>
  );
}

/* ---------------- Tech stack ---------------- */
export function StackView({ browser, server }: { browser: { name: string; version: string | null }[]; server?: StackItem[] }) {
  const all = new Map<string, StackItem>();
  for (const s of server || []) all.set(s.name, s);
  const alias: Record<string, string> = { "Stripe.js": "Stripe", "Framer (site builder)": "Framer" };
  for (const raw of browser) {
    const b = { ...raw, name: alias[raw.name] || raw.name };
    const e = all.get(b.name);
    all.set(b.name, { name: b.name, category: e?.category || categoryOf(b.name), version: b.version || e?.version || null, how: e ? e.how : "live page" });
  }
  const groups = new Map<string, StackItem[]>();
  for (const s of all.values()) groups.set(s.category, [...(groups.get(s.category) || []), s]);
  const order = [...groups.keys()].sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)));
  return (
    <Card title="Tech stack" icon={Layers} right={`${all.size} found`} className="lg:col-span-2">
      {all.size ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {order.map((g) => (
            <div key={g} className="rounded-xl border border-slate-100 p-3 dark:border-white/10">
              <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${muted}`}>{g}</div>
              <div className="flex flex-wrap gap-2">{groups.get(g)!.map((s) => <span key={s.name} title={s.how ? `Found in: ${s.how}` : undefined}><Badge t="violet">{s.name}{s.version ? ` ${s.version}` : ""}</Badge></span>)}</div>
            </div>
          ))}
        </div>
      ) : <p className={`text-sm ${muted}`}>Nothing detected.</p>}
      <p className={`mt-3 text-xs ${muted}`}>Found from the page code, response headers and cookies. Hover a name to see where it was found.</p>
    </Card>
  );
}

/* ---------------- Speed score (Google PageSpeed) + carbon ---------------- */
const fieldWord: Record<string, [string, Tone]> = { fast: ["Good", "green"], average: ["Needs work", "amber"], slow: ["Poor", "red"] };
export function SpeedScore({ speed, busy }: { speed?: SpeedResult; busy: boolean }) {
  const [mode, setMode] = useState<"mobile" | "desktop">("mobile");
  if (!speed || (!speed.runs?.length && !speed.carbon)) return <Status busy={busy} data={speed} what="Google speed score" />;
  const run: PsiRun | undefined = speed.runs?.find((r) => r.strategy === mode) || speed.runs?.[0];
  const c = speed.carbon;
  const ratingTone: Tone = !c ? "slate" : /^A/.test(c.rating) ? "green" : /[BC]/.test(c.rating) ? "amber" : "red";
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {run && (
        <Card title="Google speed score" icon={Gauge} className="lg:col-span-2" right={
          <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-white/10">
            {(["mobile", "desktop"] as const).filter((m) => speed.runs!.some((r) => r.strategy === m)).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`${btn} ${run.strategy === m ? "bg-white text-indigo-600 shadow dark:bg-white/20 dark:text-white" : ""}`}>{m === "mobile" ? <Smartphone size={13} /> : <Monitor size={13} />}{m === "mobile" ? "Phone" : "Computer"}</button>
            ))}
          </div>}>
          <div className="flex flex-wrap items-center gap-6">
            <Ring value={run.score} />
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              {run.metrics.map((m) => <div key={m.key} className="flex items-center justify-between gap-2 text-sm"><span className={muted}>{m.label}</span><Badge t={scoreTone(m.score)}>{m.value}</Badge></div>)}
            </div>
          </div>
          {run.field && <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
            <div className="mb-2 text-xs font-semibold">Real visitors (Chrome data, last 28 days)</div>
            <div className="flex flex-wrap gap-2">{run.field.map((f) => <Badge key={f.key} t={fieldWord[f.rating]?.[1] || "slate"}>{f.label} {f.value} · {fieldWord[f.rating]?.[0] || f.rating}</Badge>)}</div>
          </div>}
          {run.opportunities.length > 0 && <div className="mt-4">
            <div className="mb-2 text-xs font-semibold">How to make it faster</div>
            <ul className="space-y-1.5 text-sm">{run.opportunities.map((o) => <li key={o.title} className="flex items-start justify-between gap-3"><span className="flex gap-2"><Wrench size={14} className="mt-1 shrink-0 text-indigo-500" />{o.title}</span>{o.saving && <span className={`shrink-0 text-xs ${muted}`}>{o.saving}</span>}</li>)}</ul>
          </div>}
          <p className={`mt-3 text-xs ${muted}`}>From Google PageSpeed Insights (home page). 90+ is good, 50-89 needs work, under 50 is poor.{speed.note ? ` ${speed.note}` : ""}</p>
        </Card>
      )}
      {!run && <div className="lg:col-span-2"><Status busy={false} data={{ error: speed.error }} what="Google speed score" /></div>}
      {c && (
        <Card title="Carbon per visit" icon={Leaf}>
          <div className="flex items-end gap-3"><div className="text-4xl font-bold tracking-tight">{c.grams.toFixed(2)}<span className="ml-1 text-base font-medium">g CO₂</span></div><Badge t={ratingTone}>Rating {c.rating}</Badge></div>
          <ul className={`mt-4 space-y-1.5 text-sm ${muted}`}>
            <li>Page size: <b className="text-slate-700 dark:text-slate-200">{(c.bytes / 1024 / 1024).toFixed(2)} MB</b></li>
            <li>Green hosting: <b className="text-slate-700 dark:text-slate-200">{c.green === true ? "Yes" : c.green === false ? "Not verified" : "Unknown"}</b></li>
            <li>10,000 visits a month ≈ <b className="text-slate-700 dark:text-slate-200">{c.yearlyKg10k} kg CO₂ a year</b></li>
          </ul>
          <p className={`mt-3 text-xs ${muted}`}>Estimate using the Sustainable Web Design model v4 (CO2.js). Ratings go from A+ (best) to F. Smaller pages and green hosting lower it.</p>
        </Card>
      )}
    </div>
  );
}

/* ---------------- Trust / scam check ---------------- */
export function TrustView({ trust, busy }: { trust?: TrustResult; busy: boolean }) {
  if (!trust?.checks) return <Status busy={busy} data={trust} what="trust check" />;
  const v = trust.verdict!;
  const head: Record<string, [string, string, React.ElementType, string]> = {
    safe: ["Looks trustworthy", "No warning signs in the checks below.", ShieldCheck, "from-emerald-500 to-teal-500"],
    caution: ["Be careful", "Some warning signs. Check the items in red before you buy or sign up.", AlertTriangle, "from-amber-400 to-orange-500"],
    risky: ["High risk", "Strong warning signs. Do not enter passwords or card details here.", ShieldAlert, "from-red-500 to-rose-500"],
  };
  const [title, sub, Icon, grad] = head[v];
  return (
    <div className="grid gap-5">
      <section data-anim="card" className={`${card} flex flex-wrap items-center gap-5`}>
        <div className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${grad}`}><Icon size={30} /></div>
        <div className="min-w-0 flex-1"><div className="text-xl font-bold">{title}</div><div className={`text-sm ${muted}`}>{sub}</div></div>
        <div className="text-right"><div className="text-3xl font-bold">{trust.score}<span className="text-base font-medium">/100</span></div><div className={`text-xs ${muted}`}>Trust score</div></div>
      </section>
      <Card title="What we checked" icon={ShieldCheck} right={trust.domain}>
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {trust.checks.map((c) => (
            <li key={c.name} className="flex items-start gap-3 py-2.5 text-sm">
              {c.ok === true ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" /> : c.ok === false ? <XCircle size={18} className={`mt-0.5 shrink-0 ${c.weight === "low" ? "text-amber-500" : "text-red-500"}`} /> : <HelpCircle size={18} className="mt-0.5 shrink-0 text-slate-400" />}
              <div className="min-w-0"><div className="font-medium">{c.name}</div><div className={`text-xs ${muted}`}>{c.detail}</div></div>
            </li>
          ))}
        </ul>
        {trust.domainInfo?.registrar && <p className={`mt-3 text-xs ${muted}`}>Registrar: {trust.domainInfo.registrar}</p>}
        <p className={`mt-1 text-xs ${muted}`}>A guide, not a guarantee. Domain data comes from RDAP; unsafe-site data from Google Safe Browsing.</p>
      </Card>
    </div>
  );
}

/* ---------------- SEO fixes with code ---------------- */
export function SeoFixView({ data, busy }: { data?: SeoFixResult; busy: boolean }) {
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");
  if (!data?.fixes) return <Status busy={busy} data={data} what="SEO fix list" />;
  const list = data.fixes.filter((f) => filter === "all" || f.priority === filter);
  const ptone: Record<string, Tone> = { high: "red", medium: "amber", low: "slate" };
  return (
    <Card title="SEO fixes with ready-to-paste code" icon={Wrench} right={
      <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-white/10">
        {(["all", "high", "medium", "low"] as const).map((k) => <button key={k} onClick={() => setFilter(k)} className={`${btn} capitalize ${filter === k ? "bg-white text-indigo-600 shadow dark:bg-white/20 dark:text-white" : ""}`}>{k} ({k === "all" ? data.fixes!.length : data.fixes!.filter((f) => f.priority === k).length})</button>)}
      </div>}>
      {data.note && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{data.note}</p>}
      {!data.fixes.length && <p className={`text-sm ${muted}`}>No SEO problems found. Nice work!</p>}
      <ul className="space-y-4">
        {list.map((f, i) => (
          <li key={i} data-row className="rounded-xl border border-slate-100 p-4 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge t={ptone[f.priority]}>{f.priority}</Badge>
              <span className="font-mono text-xs text-indigo-600 dark:text-indigo-300">{f.page}</span>
              {f.ai && <Badge t="violet"><Sparkles size={11} className="mr-1" />AI text</Badge>}
            </div>
            <div className="mt-2 font-medium">{f.issue}</div>
            <div className={`text-sm ${muted}`}>{f.fix}</div>
            {f.code && <div className="relative mt-3">
              <pre className="max-h-72 overflow-auto rounded-xl bg-slate-900 p-4 pr-20 font-mono text-xs text-slate-100">{f.code}</pre>
              <div className="absolute right-2 top-2"><CopyBtn text={f.code} /></div>
            </div>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Competitors (Gemini + Google Search) ---------------- */
export function CompetitorsView({ data, busy, onCompare }: { data?: CompetitorResult; busy: boolean; onCompare?: (url: string) => void }) {
  if (!data?.competitors) return <Status busy={busy} data={data} what="competitor list" />;
  return (
    <div className="grid gap-5">
      {data.summary && <section data-anim="card" className={`${card} text-sm`}><b>What this site does: </b>{data.summary}</section>}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.competitors.map((c) => {
          const host = (() => { try { return new URL(c.url).hostname.replace(/^www\./, ""); } catch { return c.url; } })();
          return (
            <section key={c.url} data-anim="card" className={`${card} flex flex-col`}>
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 font-bold text-white">{c.name.slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0"><div className="truncate font-semibold">{c.name}</div><a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-300">{host}<ExternalLink size={11} /></a></div>
              </div>
              <p className="mt-3 text-sm">{c.why}</p>
              {c.strengths && <p className={`mt-1 text-xs ${muted}`}>Strength: {c.strengths}</p>}
              {onCompare && <button onClick={() => onCompare(c.url)} className={`${btn} mt-4 self-start bg-gradient-to-r from-indigo-500 to-violet-500 text-white`}><Users size={13} /> Analyze this site</button>}
            </section>
          );
        })}
      </div>
      {!!data.sources?.length && <Card title="Sources Google Search used" icon={ExternalLink}>
        <ul className="flex flex-wrap gap-2 text-xs">{data.sources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-slate-100 px-2.5 py-1 hover:underline dark:bg-white/10">{s.title || "source"}</a></li>)}</ul>
        <p className={`mt-3 text-xs ${muted}`}>Found by Google Gemini{data.model ? ` (${data.model})` : ""} using live Google Search.</p>
      </Card>}
    </div>
  );
}

export type { Extras };
