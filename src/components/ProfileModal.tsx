"use client";

import { useState } from "react";
import { Lock, LogOut, Mail, User as UserIcon } from "lucide-react";
import type { User } from "@/lib/firebase";
import { COUNTRIES } from "@/lib/countries";
import { completeProfile } from "@/lib/profile";
import Select from "@/components/Select";

/**
 * "Complete your profile": shown once after a Google sign-up (and to older accounts without a country).
 * Asks for name and country, and for a password so the account also works with email + password.
 */
export default function ProfileModal({ user, onDone, onLogout }: { user: User; onDone: () => void; onLogout: () => void }) {
  const hasPassword = user.providerData.some((p) => p.providerId === "password");
  const [name, setName] = useState(user.displayName || "");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (name.trim().length < 2) return setErr("Please enter your name.");
    if (!country) return setErr("Please choose your country.");
    if (!hasPassword && password !== confirm) return setErr("The two passwords do not match.");
    setBusy(true);
    try { await completeProfile({ name, country, password: hasPassword ? undefined : password }); onDone(); }
    catch (x) { setErr((x as Error).message || "Could not save. Please try again."); }
    finally { setBusy(false); }
  }

  const input = "w-full bg-transparent text-sm outline-none placeholder:text-slate-400";
  const box = "flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-indigo-400 dark:border-white/10 dark:bg-white/5";
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label="Complete your profile">
      <form onSubmit={submit} className="glass-panel max-h-[94vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#16162a]">
        <div className="mb-5 flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" className="mr-3 h-9 w-9" />
          <div>
            <h2 className="text-lg font-bold">Complete your profile</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">One last step before you start.</p>
          </div>
        </div>
        <div className="space-y-3">
          <label className={box}><UserIcon size={16} className="text-slate-400" /><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={input} autoComplete="name" maxLength={60} /></label>
          <Select searchable ariaLabel="Country" value={country} onChange={setCountry} placeholder="Country" options={COUNTRIES.map((c) => ({ value: c, label: c }))} />
          <label className={`${box} opacity-70`}><Mail size={16} className="text-slate-400" /><input value={user.email || ""} readOnly aria-label="Email" className={input} /></label>
          {!hasPassword && (
            <>
              <label className={box}><Lock size={16} className="text-slate-400" /><input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password (min 6 characters)" className={input} autoComplete="new-password" /></label>
              <label className={box}><Lock size={16} className="text-slate-400" /><input type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" className={input} autoComplete="new-password" /></label>
              <p className="text-xs text-slate-500 dark:text-slate-400">With a password you can log in with Google or with your email.</p>
            </>
          )}
        </div>
        {err && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{err}</p>}
        <button disabled={busy} className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-60">{busy ? "Saving…" : "Save and continue"}</button>
        <button type="button" onClick={onLogout} className="mx-auto mt-3 flex items-center gap-1.5 text-xs text-slate-500 hover:underline dark:text-slate-400"><LogOut size={12} /> Log out instead</button>
      </form>
    </div>
  );
}
