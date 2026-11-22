"use client";

import { useState } from "react";
import { X, Mail, Lock, LogIn, UserPlus } from "lucide-react";
import { login, loginWithGoogle, resetPassword, signup } from "@/lib/firebase";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === "login") await login(email, password);
      else { await signup(email, password); setMsg({ ok: true, text: "Account created. We sent a verification link to your email." }); setBusy(false); setTimeout(onClose, 1800); return; }
      onClose();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full bg-transparent text-sm outline-none placeholder:text-slate-400";
  const box = "flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-indigo-400 dark:border-white/10 dark:bg-white/5";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="glass-panel w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#16162a]">
        <div className="mb-5 flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" className="mr-3 h-9 w-9" />
          <div>
            <h2 className="text-lg font-bold">{mode === "login" ? "Log in" : "Create account"}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Save every analysis and see your history.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <button type="button" disabled={busy}
          onClick={async () => { setBusy(true); setMsg(null); try { await loginWithGoogle(); onClose(); } catch (err) { setMsg({ ok: false, text: (err as Error).message }); } finally { setBusy(false); } }}
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          Continue with Google
        </button>
        <div className="mb-4 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />or with email<span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>
        <div className="space-y-3">
          <label className={box}><Mail size={16} className="text-slate-400" /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={input} autoComplete="email" /></label>
          <label className={box}><Lock size={16} className="text-slate-400" /><input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 characters)" className={input} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        </div>
        {mode === "login" && (
          <button type="button" disabled={busy} className="mt-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            onClick={async () => {
              if (!email) { setMsg({ ok: false, text: "Type your email above first." }); return; }
              setBusy(true); setMsg(null);
              try { await resetPassword(email); setMsg({ ok: true, text: `If an account exists for ${email}, a link to set a new password is on its way. Check your inbox and spam.` }); }
              catch (err) { setMsg({ ok: false, text: (err as Error).message }); } finally { setBusy(false); }
            }}>Forgot password?</button>
        )}
        {msg && <p className={`mt-3 rounded-lg p-2.5 text-xs ${msg.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"}`}>{msg.text}</p>}
        <button disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-60">
          {mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />} {busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
        </button>
        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(null); }} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </form>
    </div>
  );
}
