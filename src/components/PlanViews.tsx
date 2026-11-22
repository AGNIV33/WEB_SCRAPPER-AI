"use client";

import { useState } from "react";
import { Lock, LogIn, Check, Crown, Sparkles, X, Globe } from "lucide-react";
import { LIMITS, type Usage } from "@/lib/usage";

const card = "glass-panel min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_24px_-8px_rgba(99,102,241,0.15)] dark:border-white/10 dark:bg-[#16162a]";
const muted = "text-slate-500 dark:text-slate-400";
const btn = "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30";

/** Shown instead of a feature that needs an account. */
export function LockedView({ onLogin }: { onLogin: () => void }) {
  return (
    <div className={`${card} mx-auto max-w-lg p-8 text-center`}>
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><Lock size={26} /></div>
      <h2 className="mt-4 text-xl font-bold">Sign in to unlock this</h2>
      <p className={`mt-2 text-sm ${muted}`}>Without an account you can analyse <b>1 page</b> and see colours, fonts, animations and the tech stack.</p>
      <ul className={`mx-auto mt-4 max-w-xs space-y-1.5 text-left text-sm ${muted}`}>
        {["Up to 50 pages per website", "Screenshots on desktop, tablet and mobile", "Security, SEO, speed and accessibility", "AI suggestions and the full design.md", "Media downloads, code export, PDF/Excel", "History, compare and share links"].map((f) => (
          <li key={f} className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {f}</li>
        ))}
      </ul>
      <button onClick={onLogin} className={`${btn} mt-6`}><LogIn size={16} /> Sign in or create a free account</button>
    </div>
  );
}

/** Small lock overlay for a card on the Overview page (guests). */
export function LockOverlay({ onLogin, children, label = "Sign in to see this" }: { onLogin: () => void; children: React.ReactNode; label?: string }) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[6px] opacity-60" aria-hidden>{children}</div>
      <button onClick={onLogin} className="absolute inset-0 m-auto flex h-fit w-fit items-center gap-2 rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-lg dark:bg-[#16162a]/90 dark:text-indigo-200">
        <Lock size={15} /> {label}
      </button>
    </div>
  );
}

const PLANS = [
  { id: "free", name: "Free", price: "₹0", period: "forever", features: [`${LIMITS.freeSites} websites`, `${LIMITS.freeScansPerSite} scans per website (retries)`, "Up to 50 pages per scan", "All analysis features", "History, compare, share links"] },
  { id: "pro", name: "Pro", price: "₹499", period: "per month", popular: true, features: ["Unlimited websites", "Unlimited re-scans", "Weekly auto-scan + email alerts", "Priority AI (faster)", "Everything in Free"] },
  { id: "team", name: "Team", price: "₹1,999", period: "per month", features: ["Everything in Pro", "5 team members", "Shared history", "White-label PDF reports", "Email support"] },
];

/** Plans + current usage. Payment is a demo (no real checkout yet). */
export function PricingView({ usage, loggedIn, onLogin }: { usage: Usage | null; loggedIn: boolean; onLogin: () => void }) {
  const [checkout, setCheckout] = useState<string | null>(null);
  const sites = Object.entries(usage?.sites || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold"><Crown size={22} className="text-amber-500" /> Plans</h2>
        <p className={`text-sm ${muted}`}>Free accounts get {LIMITS.freeSites} websites, each scanned up to {LIMITS.freeScansPerSite} times. Upgrade for more.</p>
      </div>

      {loggedIn && usage && (
        <section data-anim="card" className={`${card} p-5`}>
          <div className="flex flex-wrap items-center gap-6">
            <div><div className={`text-xs ${muted}`}>Websites used</div><div className="text-2xl font-bold">{usage.uniqueCount || 0}<span className="text-base text-slate-400">/{LIMITS.freeSites}</span></div></div>
            <div><div className={`text-xs ${muted}`}>Total scans</div><div className="text-2xl font-bold">{usage.total || 0}</div></div>
            <div className="min-w-[200px] flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${Math.min(100, ((usage.uniqueCount || 0) / LIMITS.freeSites) * 100)}%` }} /></div>
            </div>
          </div>
          {sites.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {sites.map(([k, n]) => <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-white/10"><Globe size={12} /> {k.replace(/_/g, ".")} <b className={n >= LIMITS.freeScansPerSite ? "text-red-500" : ""}>{n}/{LIMITS.freeScansPerSite}</b></span>)}
            </div>
          )}
        </section>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.id} data-anim="card" className={`${card} relative flex flex-col p-6 ${p.popular ? "ring-2 ring-indigo-500" : ""}`}>
            {p.popular && <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-0.5 text-xs font-semibold text-white">Most popular</span>}
            <div className="text-lg font-bold">{p.name}</div>
            <div className="mt-2"><span className="text-3xl font-bold">{p.price}</span> <span className={`text-sm ${muted}`}>{p.period}</span></div>
            <ul className="mt-4 flex-1 space-y-2 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {f}</li>)}</ul>
            {p.id === "free"
              ? (loggedIn ? <div className={`mt-6 rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold dark:border-white/10`}>Current plan</div> : <button onClick={onLogin} className={`${btn} mt-6`}>Create free account</button>)
              : <button onClick={() => setCheckout(p.name)} className={`${btn} mt-6`}><Sparkles size={16} /> Upgrade to {p.name}</button>}
          </div>
        ))}
      </div>

      {checkout && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setCheckout(null)}>
          <div className={`${card} w-full max-w-md p-6`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center"><h3 className="text-lg font-bold">Upgrade to {checkout}</h3><button onClick={() => setCheckout(null)} className="ml-auto text-slate-400" aria-label="Close"><X size={18} /></button></div>
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <b>Demo checkout.</b> Online payments are not switched on yet, so nothing is charged and no card details are collected.
            </div>
            <p className={`mt-4 text-sm ${muted}`}>When payments go live (for example with Razorpay or Stripe), this button will open a secure payment page from the payment provider.</p>
            <button onClick={() => setCheckout(null)} className={`${btn} mt-5 w-full`}>OK, got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
