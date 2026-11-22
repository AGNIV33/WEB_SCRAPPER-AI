"use client";

import { useMemo } from "react";
import type { User } from "@/lib/firebase";

const BY_TIME = (h: number) => (h < 5 ? "Burning the midnight oil" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 22 ? "Good evening" : "Up late");
const LINES: [string, string][] = [
  ["{t}, {n}!", "👋"], ["Welcome back, {n}!", "🚀"], ["Ready to analyse something, {n}?", "🔍"], ["Hey {n}, what are we exploring today?", "🧭"],
  ["Nice to see you, {n}!", "😊"], ["{n}, let's find some great design ideas", "🎨"], ["Let's make the web beautiful, {n}", "✨"],
  ["{t}! Paste a link and let's go, {n}", "⚡"], ["Good to have you here, {n}", "🙌"], ["{n}, your next big idea starts here", "💡"],
];

const firstName = (u: User) => (u.displayName || u.email?.split("@")[0] || "there").split(/[\s._-]/)[0].replace(/^\w/, (c) => c.toUpperCase());

/** A new friendly greeting each time the user signs in (kept the same while they stay signed in). */
export default function Greeting({ user }: { user: User | null }) {
  const line = useMemo(() => {
    if (!user) return null;
    // Each sign-in has a new sign-in time, so hashing it picks a different greeting every login
    const seed = `${user.uid}|${user.metadata.lastSignInTime || ""}`;
    let h = 0;
    for (let k = 0; k < seed.length; k++) h = (h * 31 + seed.charCodeAt(k)) >>> 0;
    const [tpl, emoji] = LINES[h % LINES.length];
    return { text: tpl.replace("{t}", BY_TIME(new Date().getHours())).replace("{n}", firstName(user)), emoji };
  }, [user]);

  if (!line) return null;
  return (
    <div className="hidden min-w-0 items-center gap-2 truncate text-sm font-medium text-slate-600 animate-[topbar-in_.6s_ease-out] dark:text-slate-300 sm:flex">
      <span className="inline-block origin-[70%_70%] text-lg animate-[wave_2.2s_ease-in-out_1]">{line.emoji}</span>
      <span className="truncate">{line.text}</span>
    </div>
  );
}
