"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, Bug, ChevronDown, Clock, Crown, Download, Eye, Globe, Lightbulb, Mail, MessageSquare, RefreshCw, RotateCcw,
  Search, Send, ShieldCheck, Trash2, UserPlus, Users, Zap, Check, X,
} from "lucide-react";
import { deleteFeedback, removeUser, restoreUser, setPlan, updateFeedback, watchAdminData, type AdminData, type EventRow, type UserRow } from "@/lib/admin";
import { TYPE_LABEL, type FeedbackItem, type FeedbackStatus } from "@/lib/feedback";
import { ago } from "@/lib/notify";
import Select from "@/components/Select";

const card = "glass-panel min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]";
const muted = "text-slate-500 dark:text-slate-400";
const chip = "rounded-lg px-3 py-1.5 text-sm font-medium transition";
const DAY = 86400000;

const dur = (s: number) => { s = Math.round(s); if (s < 60) return `${s} s`; const m = Math.floor(s / 60); if (m < 60) return `${m} min`; const h = Math.floor(m / 60); return `${h} h ${String(m % 60).padStart(2, "0")} min`; };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "0%");
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nf = (n: number) => n.toLocaleString();

const niceError = (e: unknown) => {
  const m = (e as Error).message || "";
  return /permission|insufficient/i.test(m) ? "Firestore refused the request. Publish the latest firestore.rules (with your admin email) in Firebase → Firestore → Rules, then reload." : m;
};

type Tab = "overview" | "users" | "feedback" | "errors";
type Stat = { scans: number; scanErrors: number; errorEvents: number; pagesOk: number; pagesFailed: number; apiCalls: number; lastScan: Date | null };

/** Admin dashboard: usage, users, errors and the feedback inbox. Data comes from Firestore (admin-only by security rules). */
export default function AdminView({ currentUid, onChanged }: { currentUid?: string; onChanged?: () => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState(14);

  // Live: Firestore pushes every change (new sign-up, scan, message), so nothing needs refreshing
  const [conn, setConn] = useState(0);
  useEffect(() => watchAdminData((d) => { setData(d); setErr(null); setLoading(false); }, (e) => { setErr(niceError(e)); setLoading(false); }), [conn]);
  const refresh = useCallback(() => { setLoading(true); setConn((n) => n + 1); }, []);
  const emailOf = useMemo(() => { const m = new Map<string, string>(); data?.users.forEach((u) => m.set(u.uid, u.email || `${u.uid.slice(0, 8)}…`)); return (uid: string) => m.get(uid) || `${uid.slice(0, 8)}…`; }, [data]);

  const stats = useMemo(() => {
    const m = new Map<string, Stat>();
    const blank = (): Stat => ({ scans: 0, scanErrors: 0, errorEvents: 0, pagesOk: 0, pagesFailed: 0, apiCalls: 0, lastScan: null });
    data?.events.forEach((e) => {
      const s = m.get(e.uid) || blank(); m.set(e.uid, s);
      if (e.type === "scan") {
        s.scans++; s.pagesOk += e.pagesOk; s.pagesFailed += e.pagesFailed; s.apiCalls += e.apiCalls;
        if (e.status === "error") s.scanErrors++;
        if (!s.lastScan || e.at > s.lastScan) s.lastScan = e.at;
      } else s.errorEvents++;
    });
    return (uid: string) => m.get(uid) || blank();
  }, [data]);

  if (loading && !data) return <div className={`${card} p-8 text-center text-sm ${muted}`}><RefreshCw size={20} className="mx-auto mb-2 animate-spin" /> Loading admin data…</div>;
  if (err && !data) {
    return (
      <div className={`${card} mx-auto max-w-xl p-8 text-center`}>
        <AlertTriangle size={26} className="mx-auto text-amber-500" />
        <h2 className="mt-3 text-lg font-bold">Could not load the admin data</h2>
        <p className={`mt-2 text-sm ${muted}`}>{err}</p>
        <button onClick={refresh} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white"><RefreshCw size={15} /> Try again</button>
      </div>
    );
  }
  if (!data) return null;
  const newFeedback = data.feedback.filter((f) => f.status === "new").length;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30"><ShieldCheck size={20} /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">Admin dashboard</h2>
          <p className={`flex items-center gap-1.5 text-xs ${muted}`}><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>Live · updated {ago(data.loadedAt.getTime())}{data.eventsTruncated ? " · graphs use the latest 3,000 events" : ""}</p>
        </div>
        <button onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/5"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
      </div>
      {err && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{err}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        {([["overview", "Overview", BarChart3], ["users", `Users (${data.users.length})`, Users], ["feedback", "Feedback", MessageSquare], ["errors", "Errors", Bug]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`${chip} inline-flex items-center gap-2 ${tab === id ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25" : "text-slate-600 hover:bg-indigo-50 dark:text-slate-300 dark:hover:bg-white/5"}`}>
            <Icon size={15} /> {label}
            {id === "feedback" && newFeedback > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{newFeedback}</span>}
          </button>
        ))}
        {tab === "overview" && (
          <div className="ml-auto flex gap-1 rounded-xl border border-slate-200 p-1 dark:border-white/10">
            {[7, 14, 30].map((d) => <button key={d} onClick={() => setRange(d)} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${range === d ? "bg-indigo-500 text-white" : muted}`}>{d} days</button>)}
          </div>
        )}
      </div>

      {tab === "overview" && <Overview data={data} range={range} stats={stats} emailOf={emailOf} />}
      {tab === "users" && <UsersTab data={data} stats={stats} currentUid={currentUid} reload={async () => { onChanged?.(); }} />}
      {tab === "feedback" && <FeedbackTab items={data.feedback} reload={async () => { onChanged?.(); }} />}
      {tab === "errors" && <ErrorsTab events={data.events} emailOf={emailOf} />}
    </div>
  );
}

/* ---------- charts (plain SVG) ---------- */
function Bars({ data, colorA = "#6366f1", colorB = "#f43f5e", labelA, labelB }: { data: { label: string; a: number; b?: number }[]; colorA?: string; colorB?: string; labelA: string; labelB?: string }) {
  const W = 600, H = 150, pad = 22, max = Math.max(1, ...data.map((d) => d.a + (d.b || 0)));
  const bw = (W - 8) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + pad}`} className="w-full" role="img" aria-label="Bar chart">
      {[0.25, 0.5, 0.75, 1].map((t) => <line key={t} x1={0} x2={W} y1={H - H * t} y2={H - H * t} stroke="currentColor" strokeOpacity={0.08} />)}
      {data.map((d, i) => {
        const ha = (d.a / max) * (H - 8), hb = ((d.b || 0) / max) * (H - 8), x = 4 + i * bw;
        return (
          <g key={i}>
            <title>{`${d.label}: ${nf(d.a)} ${labelA}${labelB ? `, ${nf(d.b || 0)} ${labelB}` : ""}`}</title>
            <rect x={x + bw * 0.15} y={H - ha} width={bw * 0.7} height={Math.max(ha, d.a ? 1 : 0)} rx={3} fill={colorA} />
            {hb > 0 && <rect x={x + bw * 0.15} y={H - ha - hb} width={bw * 0.7} height={hb} rx={3} fill={colorB} />}
            {(i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 6) === 0) && <text x={x + bw / 2} y={H + 15} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.55}>{d.label}</text>}
          </g>
        );
      })}
      <text x={W} y={10} textAnchor="end" fontSize={11} fill="currentColor" opacity={0.5}>max {nf(max)}</text>
    </svg>
  );
}

function Donut({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((t, p) => t + p.value, 0) || 1, r = 42, C = 2 * Math.PI * r;
  const segs = parts.map((p, i) => ({ ...p, start: parts.slice(0, i).reduce((t, q) => t + q.value, 0) }));
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0 -rotate-90" role="img" aria-label="Plan split">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth="16" />
        {segs.map((p) => { const len = (p.value / total) * C; return <circle key={p.label} cx="60" cy="60" r={r} fill="none" stroke={p.color} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-(p.start / total) * C} />; })}
      </svg>
      <ul className="space-y-1.5 text-sm">{parts.map((p) => <li key={p.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /> {p.label} <b>{p.value}</b></li>)}</ul>
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub, tone = "indigo" }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "indigo" | "emerald" | "rose" | "amber" | "sky" }) {
  const t = { indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300", emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300", rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300", amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300", sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" }[tone];
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-start justify-between gap-2"><div className={`text-xs ${muted}`}>{label}</div><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${t}`}><Icon size={16} /></span></div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${muted}`}>{sub}</div>}
    </div>
  );
}

/* ---------- overview ---------- */
function Overview({ data, range, stats, emailOf }: { data: AdminData; range: number; stats: (uid: string) => Stat; emailOf: (uid: string) => string }) {
  const o = useMemo(() => {
    const now = data.loadedAt.getTime(), since = now - range * DAY;
    const days: { key: string; label: string }[] = [];
    for (let i = range - 1; i >= 0; i--) { const d = new Date(now - i * DAY); days.push({ key: dayKey(d), label: `${d.getDate()}/${d.getMonth() + 1}` }); }
    const idx = new Map(days.map((d, i) => [d.key, i]));
    const scansD = days.map((d) => ({ label: d.label, a: 0, b: 0 })), apiD = days.map((d) => ({ label: d.label, a: 0 })), usersD = days.map((d) => ({ label: d.label, a: 0 })), errD = days.map((d) => ({ label: d.label, a: 0 }));
    const ev = data.events.filter((e) => e.at.getTime() >= since), scans = ev.filter((e) => e.type === "scan");
    ev.forEach((e) => {
      const i = idx.get(dayKey(e.at)); if (i === undefined) return;
      if (e.type === "scan") { if (e.status === "error") scansD[i].b++; else scansD[i].a++; apiD[i].a += e.apiCalls; if (e.status === "error") errD[i].a++; } else errD[i].a++;
    });
    data.users.forEach((u) => { const i = u.createdAt ? idx.get(dayKey(u.createdAt)) : undefined; if (i !== undefined) usersD[i].a++; });
    const hosts = new Map<string, number>(); scans.forEach((e) => e.host && hosts.set(e.host, (hosts.get(e.host) || 0) + 1));
    const countries = new Map<string, number>(); data.users.forEach((u) => { if (u.country) countries.set(u.country, (countries.get(u.country) || 0) + 1); });
    const active = (ms: number) => data.users.filter((u) => u.lastSeen && now - u.lastSeen.getTime() < ms).length;
    const pagesOk = scans.reduce((t, e) => t + e.pagesOk, 0), pagesFailed = scans.reduce((t, e) => t + e.pagesFailed, 0);
    return {
      scansD, apiD, usersD, errD, scans: scans.length, scanErrors: scans.filter((e) => e.status === "error").length, errorEvents: ev.filter((e) => e.type === "error").length,
      pagesOk, pagesFailed, api: scans.reduce((t, e) => t + e.apiCalls, 0), lite: scans.reduce((t, e) => t + e.lite, 0), ai: scans.filter((e) => e.ai).length,
      avgSeconds: scans.length ? scans.reduce((t, e) => t + e.seconds, 0) / scans.length : 0,
      newUsers: data.users.filter((u) => u.createdAt && u.createdAt.getTime() >= since).length,
      active24: active(DAY), active7: active(7 * DAY),
      topCountries: [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      topHosts: [...hosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      topUsers: data.users.map((u) => ({ u, s: stats(u.uid) })).sort((a, b) => b.s.scans - a.s.scans).slice(0, 5).filter((x) => x.s.scans > 0),
    };
  }, [data, range, stats]);
  const paid = data.users.filter((u) => u.plan === "pro").length;
  const totalTime = data.users.reduce((t, u) => t + u.timeSpentSec, 0);
  const totalScansAll = data.users.reduce((t, u) => t + u.total, 0);
  const totalSites = data.users.reduce((t, u) => t + u.uniqueCount, 0);

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={Users} label="Total users" value={nf(data.users.length)} sub={`${o.active24} active in 24 h · ${o.active7} in 7 days`} />
        <Tile icon={UserPlus} label={`New users (${range} days)`} value={nf(o.newUsers)} tone="emerald" sub={`${paid} on a paid plan`} />
        <Tile icon={Globe} label="Scans, all time" value={nf(totalScansAll)} tone="sky" sub={`${nf(totalSites)} website${totalSites === 1 ? "" : "s"} crawled`} />
        <Tile icon={Clock} label="Time spent, all users" value={dur(totalTime)} tone="amber" sub={data.users.length ? `${dur(totalTime / data.users.length)} per user` : ""} />
        <Tile icon={Activity} label={`Scans (${range} days)`} value={nf(o.scans)} sub={`${nf(o.pagesOk + o.pagesFailed)} pages · avg ${dur(o.avgSeconds)}`} />
        <Tile icon={Zap} label={`API calls (${range} days)`} value={nf(o.api)} tone="sky" sub={`${o.ai} AI runs · ${o.lite} lite page scans`} />
        <Tile icon={AlertTriangle} label="Scan error rate" value={pct(o.scanErrors, o.scans)} tone="rose" sub={`${o.scanErrors} of ${o.scans} scans failed`} />
        <Tile icon={Bug} label="Page failure rate" value={pct(o.pagesFailed, o.pagesOk + o.pagesFailed)} tone="rose" sub={`${nf(o.pagesFailed)} of ${nf(o.pagesOk + o.pagesFailed)} pages · ${o.errorEvents} other errors`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${card} p-5`}><h3 className="mb-2 font-semibold">Scans per day</h3><Bars data={o.scansD} labelA="ok" labelB="failed" /><Legend items={[["Finished", "#6366f1"], ["Failed", "#f43f5e"]]} /></section>
        <section className={`${card} p-5`}><h3 className="mb-2 font-semibold">API calls per day</h3><Bars data={o.apiD} colorA="#0ea5e9" labelA="calls" /></section>
        <section className={`${card} p-5`}><h3 className="mb-2 font-semibold">New users per day</h3><Bars data={o.usersD} colorA="#10b981" labelA="new users" /></section>
        <section className={`${card} p-5`}><h3 className="mb-2 font-semibold">Errors per day</h3><Bars data={o.errD} colorA="#f43f5e" labelA="errors" /></section>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className={`${card} p-5`}>
          <h3 className="mb-3 font-semibold">Free vs paid</h3>
          <Donut parts={[{ label: "Free", value: data.users.length - paid, color: "#6366f1" }, { label: "Paid (Pro)", value: paid, color: "#f59e0b" }]} />
        </section>
        <section className={`${card} p-5`}>
          <h3 className="mb-3 font-semibold">Users by country</h3>
          {o.topCountries.length === 0 ? <p className={`text-sm ${muted}`}>No countries yet. They appear as new users sign up.</p> : (
            <ul className="space-y-2">{o.topCountries.map(([name, n]) => (
              <li key={name} className="text-sm"><div className="flex justify-between gap-2"><span className="truncate">{name}</span><b>{n}</b></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(n / o.topCountries[0][1]) * 100}%` }} /></div></li>
            ))}</ul>
          )}
        </section>
        <section className={`${card} p-5`}>
          <h3 className="mb-3 font-semibold">Most scanned websites</h3>
          {o.topHosts.length === 0 ? <p className={`text-sm ${muted}`}>No scans in this period.</p> : (
            <ul className="space-y-2">{o.topHosts.map(([h, n]) => (
              <li key={h} className="text-sm"><div className="flex justify-between gap-2"><span className="truncate">{h}</span><b>{n}</b></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${(n / o.topHosts[0][1]) * 100}%` }} /></div></li>
            ))}</ul>
          )}
        </section>
        <section className={`${card} p-5`}>
          <h3 className="mb-3 font-semibold">Most active users</h3>
          {o.topUsers.length === 0 ? <p className={`text-sm ${muted}`}>No scans recorded yet.</p> : (
            <ul className="space-y-2.5">{o.topUsers.map(({ u, s }) => (
              <li key={u.uid} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate">{emailOf(u.uid)}</span><span className={`shrink-0 text-xs ${muted}`}><b className="text-slate-800 dark:text-slate-100">{s.scans}</b> scans · {nf(s.apiCalls)} calls</span></li>
            ))}</ul>
          )}
        </section>
      </div>
      <p className={`text-xs ${muted}`}>Usage is recorded for signed-in users from the moment this version went live. Visitors without an account are not tracked.</p>
    </div>
  );
}
const Legend = ({ items }: { items: [string, string][] }) => <div className={`mt-1 flex gap-4 text-xs ${muted}`}>{items.map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} /> {l}</span>)}</div>;

/* ---------- users ---------- */
type SortKey = "joined" | "seen" | "time" | "scans" | "api" | "errors";
function UsersTab({ data, stats, currentUid, reload }: { data: AdminData; stats: (uid: string) => Stat; currentUid?: string; reload: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("seen");
  const [plan, setPlanFilter] = useState<"all" | "free" | "pro" | "blocked">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const rows = useMemo(() => {
    const val = (u: UserRow) => ({ joined: u.createdAt?.getTime() || 0, seen: u.lastSeen?.getTime() || 0, time: u.timeSpentSec, scans: Math.max(u.total, stats(u.uid).scans), api: stats(u.uid).apiCalls, errors: stats(u.uid).scanErrors + stats(u.uid).errorEvents }[sort]);
    return data.users
      .filter((u) => (plan === "all" ? true : plan === "blocked" ? u.blocked : plan === "pro" ? u.plan === "pro" : u.plan === "free"))
      .filter((u) => !q || `${u.email} ${u.name} ${u.uid}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => val(b) - val(a));
  }, [data.users, q, sort, plan, stats]);

  async function act(uid: string, fn: () => Promise<void>, done: string) {
    setBusy(uid); setNote(null);
    try { await fn(); await reload(); setNote(done); } catch (e) { setNote(`Failed: ${(e as Error).message}`); } finally { setBusy(null); setConfirm(null); }
  }
  function csv() {
    const head = ["email", "name", "country", "plan", "status", "joined", "last_seen", "sign_ins", "time_spent_sec", "websites", "scans", "api_calls", "scan_errors", "pages_failed"];
    const lines = rows.map((u) => { const s = stats(u.uid); return [u.email, u.name, u.country, u.plan, u.blocked ? "removed" : "active", u.createdAt?.toISOString() || "", u.lastSeen?.toISOString() || "", u.logins, u.timeSpentSec, u.uniqueCount, Math.max(u.total, s.scans), s.apiCalls, s.scanErrors + s.errorEvents, s.pagesFailed].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","); });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" })); a.download = "scrapper-ai-users.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <section className={`${card} p-5`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10"><Search size={15} className={muted} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email or name" className="w-full bg-transparent text-sm outline-none" /></label>
        <div className="w-36"><Select ariaLabel="Filter users" value={plan} onChange={(v) => setPlanFilter(v as typeof plan)} options={[{ value: "all", label: "All users" }, { value: "free", label: "Free plan" }, { value: "pro", label: "Paid plan" }, { value: "blocked", label: "Removed" }]} /></div>
        <div className="w-44"><Select ariaLabel="Sort by" value={sort} onChange={(v) => setSort(v as SortKey)} options={[{ value: "seen", label: "Sort: Last seen" }, { value: "joined", label: "Sort: Newest" }, { value: "scans", label: "Sort: Most scans" }, { value: "api", label: "Sort: Most API calls" }, { value: "time", label: "Sort: Most time spent" }, { value: "errors", label: "Sort: Most errors" }]} /></div>
        <button onClick={csv} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"><Download size={14} /> CSV</button>
      </div>
      {note && <p className="mb-3 rounded-xl bg-indigo-50 p-2.5 text-sm text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">{note}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] text-left text-sm">
          <thead className={`text-xs ${muted}`}><tr>{["User", "Country", "Plan", "Joined", "Last seen", "Sign-ins", "Time spent", "Sites", "Scans", "API calls", "Errors", ""].map((h) => <th key={h} className="whitespace-nowrap py-2 pr-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={12} className={`py-8 text-center ${muted}`}>No users match.</td></tr>}
            {rows.map((u) => {
              const s = stats(u.uid), isMe = u.uid === currentUid, errors = s.scanErrors + s.errorEvents;
              return (
                <Fragment key={u.uid}>
                  <tr className={`border-t border-slate-100 dark:border-white/5 ${u.blocked ? "opacity-60" : ""}`}>
                    <td className="max-w-[260px] py-2.5 pr-3">
                      <button onClick={() => setOpen(open === u.uid ? null : u.uid)} className="flex w-full items-center gap-2 text-left" aria-expanded={open === u.uid}>
                        <ChevronDown size={14} className={`shrink-0 transition-transform ${open === u.uid ? "" : "-rotate-90"}`} />
                        <span className="min-w-0"><span className="flex items-center gap-1.5 truncate font-medium"><Mail size={12} className="shrink-0 text-indigo-500" />{u.email || <i className={muted}>email appears after next visit</i>}{isMe && <span className="rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">YOU</span>}</span>{u.name && <span className={`block truncate text-xs ${muted}`}>{u.name}</span>}</span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap pr-3">{u.country || <span className={muted}>—</span>}</td>
                    <td className="pr-3">{u.blocked ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-500/15 dark:text-red-300">Removed</span> : u.plan === "pro" ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Crown size={11} /> Paid</span> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-white/10">Free</span>}</td>
                    <td className="whitespace-nowrap pr-3">{u.createdAt ? u.createdAt.toLocaleDateString() : "—"}</td>
                    <td className="whitespace-nowrap pr-3" title={u.lastSeen?.toLocaleString()}>{u.lastSeen ? ago(u.lastSeen.getTime()) : "—"}</td>
                    <td className="pr-3">{u.logins || "—"}</td>
                    <td className="whitespace-nowrap pr-3">{u.timeSpentSec ? dur(u.timeSpentSec) : "—"}</td>
                    <td className="pr-3">{u.uniqueCount}</td>
                    <td className="pr-3">{Math.max(u.total, s.scans)}</td>
                    <td className="pr-3">{nf(s.apiCalls)}</td>
                    <td className="pr-3">{errors ? <span className="font-semibold text-rose-600 dark:text-rose-400" title={`${s.scanErrors} failed scans, ${s.errorEvents} other errors`}>{errors} <span className={`font-normal ${muted}`}>({pct(s.scanErrors, s.scans)})</span></span> : <span className={muted}>0</span>}</td>
                    <td className="whitespace-nowrap py-2 text-right">
                      {isMe ? <span className={`text-xs ${muted}`}>admin</span> : confirm === u.uid ? (
                        <span className="inline-flex items-center gap-1 text-xs">Remove{u.email ? "" : " this user"}? <button disabled={busy === u.uid} onClick={() => act(u.uid, () => removeUser(u.uid, u.email), "User removed and blocked.")} className="rounded-lg bg-red-600 px-2 py-1 font-semibold text-white">{busy === u.uid ? "…" : "Yes"}</button><button onClick={() => setConfirm(null)} className="rounded-lg border border-slate-200 px-2 py-1 dark:border-white/10">No</button></span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {!u.blocked && <div className="w-[78px]"><Select size="sm" ariaLabel="Plan" disabled={busy === u.uid} value={u.plan} onChange={(v) => act(u.uid, () => setPlan(u.uid, v as "free" | "pro"), `Plan changed to ${v === "pro" ? "Paid (Pro)" : "Free"}.`)} options={[{ value: "free", label: "Free" }, { value: "pro", label: "Paid" }]} /></div>}
                          {u.blocked
                            ? <button disabled={busy === u.uid} onClick={() => act(u.uid, () => restoreUser(u.uid), "User restored.")} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"><RotateCcw size={12} /> Restore</button>
                            : <button onClick={() => setConfirm(u.uid)} title="Remove this user" aria-label="Remove user" className="grid h-7 w-7 place-items-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 size={14} /></button>}
                        </span>
                      )}
                    </td>
                  </tr>
                  {open === u.uid && (
                    <tr className="bg-slate-50/70 dark:bg-white/[0.03]"><td colSpan={12} className="px-4 py-3">
                      <UserDetail u={u} s={s} events={data.events.filter((e) => e.uid === u.uid).slice(0, 8)} feedback={data.feedback.filter((f) => f.uid === u.uid).length} />
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={`mt-3 text-xs ${muted}`}>Removing a user deletes their saved analyses, usage and share links and blocks the account. Their login record stays in Firebase → Authentication until you delete it there. Users who signed up before this update appear here after their next visit.</p>
    </section>
  );
}

function UserDetail({ u, s, events, feedback }: { u: UserRow; s: Stat; events: EventRow[]; feedback: number }) {
  const sites = Object.entries(u.sites).sort((a, b) => b[1] - a[1]);
  return (
    <div className="grid gap-4 text-sm md:grid-cols-3">
      <div><div className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${muted}`}>Websites crawled ({sites.length})</div>
        {sites.length === 0 ? <span className={muted}>None yet</span> : <ul className="space-y-1">{sites.slice(0, 10).map(([k, n]) => <li key={k} className="flex justify-between gap-2"><span className="truncate">{k.replace(/_/g, ".")}</span><b>{n}×</b></li>)}</ul>}</div>
      <div><div className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${muted}`}>Details</div>
        <dl className="space-y-1"><div className="flex justify-between gap-2"><dt className={muted}>Pages scanned</dt><dd>{nf(s.pagesOk)} ok · {nf(s.pagesFailed)} failed</dd></div><div className="flex justify-between gap-2"><dt className={muted}>Page failure rate</dt><dd>{pct(s.pagesFailed, s.pagesOk + s.pagesFailed)}</dd></div><div className="flex justify-between gap-2"><dt className={muted}>Last scan</dt><dd>{s.lastScan ? ago(s.lastScan.getTime()) : "—"}</dd></div><div className="flex justify-between gap-2"><dt className={muted}>Messages sent</dt><dd>{feedback}</dd></div><div className="flex justify-between gap-2"><dt className={muted}>User id</dt><dd className="truncate font-mono text-xs">{u.uid}</dd></div></dl></div>
      <div><div className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${muted}`}>Recent activity</div>
        {events.length === 0 ? <span className={muted}>No events recorded</span> : <ul className="space-y-1">{events.map((e) => <li key={e.id} className="flex items-start gap-2"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${e.type === "error" || e.status === "error" ? "bg-rose-500" : "bg-emerald-500"}`} /><span className="min-w-0 flex-1 truncate">{e.type === "scan" ? `${e.host || "scan"} · ${e.pagesOk + e.pagesFailed} pages` : `${e.where || "error"}: ${e.message}`}</span><span className={`shrink-0 text-xs ${muted}`}>{ago(e.at.getTime())}</span></li>)}</ul>}</div>
    </div>
  );
}

/* ---------- feedback inbox ---------- */
function FeedbackTab({ items, reload }: { items: FeedbackItem[]; reload: () => Promise<void> }) {
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const list = items.filter((f) => filter === "all" || f.status === filter);
  const count = (s: FeedbackStatus) => items.filter((f) => f.status === s).length;

  async function run(id: string, fn: () => Promise<void>) { setBusy(id); try { await fn(); await reload(); } finally { setBusy(null); } }
  function toggle(f: FeedbackItem) {
    const next = open === f.id ? null : f.id; setOpen(next);
    if (next && f.status === "new") updateFeedback(f.id, { status: "read" }).then(reload).catch(() => {});
  }
  const icon = { feedback: MessageSquare, issue: Bug, idea: Lightbulb } as const;

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap gap-1.5">
        {([["all", `All (${items.length})`], ["new", `New (${count("new")})`], ["read", `Seen (${count("read")})`], ["resolved", `Resolved (${count("resolved")})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`${chip} ${filter === id ? "bg-indigo-500 text-white" : "border border-slate-200 dark:border-white/10"}`}>{label}</button>
        ))}
      </div>
      {list.length === 0 && <div className={`${card} p-8 text-center text-sm ${muted}`}><MessageSquare size={22} className="mx-auto mb-2 opacity-40" />No messages here.</div>}
      {list.map((f) => {
        const Icon = icon[f.type], isOpen = open === f.id;
        return (
          <article key={f.id} className={`${card} p-4 ${f.status === "new" ? "ring-1 ring-indigo-400/50" : ""}`}>
            <button onClick={() => toggle(f)} className="flex w-full items-center gap-3 text-left" aria-expanded={isOpen}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${f.type === "issue" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" : f.type === "idea" ? "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"}`}><Icon size={17} /></span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><b className="truncate">{f.subject}</b>{f.status === "new" && <span className="rounded-full bg-indigo-500 px-1.5 text-[10px] font-bold text-white">NEW</span>}{f.reply && <Check size={14} className="shrink-0 text-emerald-500" />}</span>
                <span className={`block truncate text-xs ${muted}`}>{f.email || "unknown"} · {TYPE_LABEL[f.type]} · {f.createdAt ? ago(f.createdAt.getTime()) : "just now"}</span></span>
              <ChevronDown size={16} className={`shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
            </button>
            {isOpen && (
              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
                <p className="whitespace-pre-wrap break-words text-sm">{f.message}</p>
                <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${muted}`}><span>{f.name || "No name"} · {f.email}</span><span>{f.createdAt?.toLocaleString()}</span>{f.view && <span>Site being analysed: {f.view}</span>}{f.ua && <span className="max-w-full truncate" title={f.ua}>{f.ua}</span>}</div>
                {f.reply && <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-sm dark:border-indigo-400/30 dark:bg-indigo-500/10"><div className="mb-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Your reply{f.repliedAt ? ` · ${f.repliedAt.toLocaleString()}` : ""}</div><p className="whitespace-pre-wrap break-words">{f.reply}</p></div>}
                <textarea value={reply[f.id] ?? ""} onChange={(e) => setReply({ ...reply, [f.id]: e.target.value })} rows={3} maxLength={2000} placeholder={f.reply ? "Write a new reply…" : "Write a reply. The user sees it under Contact us."} className="w-full resize-y rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-white/10" />
                <div className="flex flex-wrap items-center gap-2">
                  <button disabled={busy === f.id || !(reply[f.id] || "").trim()} onClick={() => run(f.id, async () => { await updateFeedback(f.id, { reply: reply[f.id].trim(), status: "resolved" }); setReply({ ...reply, [f.id]: "" }); })} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send size={14} /> Send reply</button>
                  {f.status !== "resolved" ? <button disabled={busy === f.id} onClick={() => run(f.id, () => updateFeedback(f.id, { status: "resolved" }))} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"><Check size={14} /> Mark resolved</button>
                    : <button disabled={busy === f.id} onClick={() => run(f.id, () => updateFeedback(f.id, { status: "read" }))} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"><Eye size={14} /> Reopen</button>}
                  <button disabled={busy === f.id} onClick={() => run(f.id, () => deleteFeedback(f.id))} className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"><X size={14} /> Delete</button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

/* ---------- errors ---------- */
function ErrorsTab({ events, emailOf }: { events: EventRow[]; emailOf: (uid: string) => string }) {
  const rows = events.filter((e) => e.type === "error" || e.status === "error" || e.pagesFailed > 0).slice(0, 150);
  return (
    <section className={`${card} p-5`}>
      <h3 className="mb-3 font-semibold">Recent errors and failed pages</h3>
      {rows.length === 0 ? <p className={`py-6 text-center text-sm ${muted}`}>No errors recorded. 🎉</p> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
          <thead className={`text-xs ${muted}`}><tr>{["When", "User", "Where", "What happened"].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>{rows.map((e) => (
            <tr key={e.id} className="border-t border-slate-100 align-top dark:border-white/5">
              <td className="whitespace-nowrap py-2.5 pr-3" title={e.at.toLocaleString()}>{ago(e.at.getTime())}</td>
              <td className="max-w-[220px] truncate pr-3">{emailOf(e.uid)}</td>
              <td className="whitespace-nowrap pr-3"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/10">{e.type === "error" ? e.where || "error" : "scan"}</span></td>
              <td className="py-2.5">{e.type === "error" ? e.message : e.status === "error" ? `Scan of ${e.host || "a site"} failed${e.message ? `: ${e.message}` : ""}` : `${e.pagesFailed} of ${e.pagesOk + e.pagesFailed} pages failed on ${e.host || "a site"}`}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}
