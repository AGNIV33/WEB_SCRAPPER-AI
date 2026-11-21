"use client";

import { useState } from "react";
import { X, Mail, Lock, LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) onClose();
        else setMsg({ ok: true, text: "Account created. Check your email and click the link to confirm, then log in." });
      }
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
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#16162a]">
        <div className="mb-5 flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" className="mr-3 h-9 w-9" />
          <div>
            <h2 className="text-lg font-bold">{mode === "login" ? "Log in" : "Create account"}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Save every analysis and see your history.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <label className={box}><Mail size={16} className="text-slate-400" /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={input} autoComplete="email" /></label>
          <label className={box}><Lock size={16} className="text-slate-400" /><input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 characters)" className={input} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        </div>
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
